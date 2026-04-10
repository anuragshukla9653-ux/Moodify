const mongoose = require("mongoose");
const moodHistoryModel = require("../models/mood-history.model");
const songModel = require("../models/song.model");
const { fetchJamendoTracksForMood } = require("../services/jamendo.service");

const ALLOWED_MOODS = new Set(["happy", "sad", "surprised"]);

function normalizeMood(value) {
    return value?.trim().toLowerCase();
}

function clampLimit(value, fallback, max) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
        return fallback;
    }

    return Math.min(Math.max(parsed, 1), max);
}

function buildMoodWeights(currentMood, recentHistory) {
    const weights = {
        happy: 0,
        sad: 0,
        surprised: 0,
    };

    const currentMoodBoosts = {
        happy: { happy: 4, sad: 1.2, surprised: 2.2 },
        sad: { happy: 1.4, sad: 4, surprised: 2.4 },
        surprised: { happy: 2.1, sad: 1.5, surprised: 4 },
    };

    const currentBoost = currentMoodBoosts[currentMood];
    if (currentBoost) {
        Object.entries(currentBoost).forEach(([mood, amount]) => {
            weights[mood] += amount;
        });
    }

    recentHistory.forEach((entry, index) => {
        const recencyWeight = Math.max(1.5 - index * 0.25, 0.5);
        weights[entry.mood] += recencyWeight;
    });

    return weights;
}

function scoreSong(song, weights) {
    const moodScore = weights[song.mood] || 0;
    const createdAt = song.createdAt ? new Date(song.createdAt).getTime() : 0;
    const ageHours = createdAt ? (Date.now() - createdAt) / 36e5 : Number.POSITIVE_INFINITY;
    const freshnessScore = Number.isFinite(ageHours)
        ? Math.max(0, 1 - Math.min(ageHours / 168, 1))
        : 0;

    return moodScore + freshnessScore;
}

function normalizeSongPoolSong(song) {
    return {
        id: song._id?.toString?.() || song.id || null,
        title: song.title,
        url: song.url,
        posterUrl: song.posterUrl || null,
        mood: song.mood,
        createdAt: song.createdAt,
        artistName: song.artistName || "",
        albumName: song.albumName || "",
        source: song.source || "local",
    };
}

function combineSongPools(localSongs, externalSongs) {
    const combined = [];
    const seen = new Set();

    for (const song of localSongs) {
        const normalizedSong = normalizeSongPoolSong(song);
        const key = `${normalizedSong.source}:${normalizedSong.id || normalizedSong.url || normalizedSong.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        combined.push(normalizedSong);
    }

    for (const song of externalSongs) {
        const key = `${song.source}:${song.externalId || song.url || song.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        combined.push(song);
    }

    return combined;
}

function buildReason(song, currentMood, recentHistory) {
    if (song.mood === currentMood) {
        return `Matches your current ${currentMood} mood.`;
    }

    const sameMoodCount = recentHistory.filter((entry) => entry.mood === song.mood).length;
    if (sameMoodCount > 0) {
        return `Keeps your recent ${song.mood} streak going.`;
    }

    return `Adds a balanced contrast to your recent listening.`;
}

function formatHistoryEntry(entry) {
    const song = entry.songId
        ? {
            id: entry.songId._id,
            title: entry.songTitle || entry.songId.title,
            mood: entry.songId.mood,
            url: entry.songId.url,
            posterUrl: entry.songPosterUrl || entry.songId.posterUrl || null,
            artistName: entry.songArtistName || entry.songId.artistName || "",
            source: entry.songSource || "local",
        }
        : entry.songExternalId || entry.songTitle
            ? {
                id: entry.songExternalId || null,
                title: entry.songTitle,
                mood: entry.mood,
                url: null,
                posterUrl: entry.songPosterUrl || null,
                artistName: entry.songArtistName || "",
                source: entry.songSource || "jamendo",
            }
            : null;

    return {
        id: entry._id,
        mood: entry.mood,
        expression: entry.expression,
        source: entry.source,
        createdAt: entry.createdAt,
        song,
    };
}

async function recordMood(req, res) {
    try {
        const mood = normalizeMood(req.body.mood);
        const expression = req.body.expression?.trim() || "";
        const source = normalizeMood(req.body.source) || "camera";
        const rawSongId = req.body.songId || null;
        const songId = rawSongId && mongoose.isValidObjectId(rawSongId) ? rawSongId : null;
        const songExternalId = req.body.songExternalId?.toString?.().trim() || "";
        const songSource = normalizeMood(req.body.songSource) || (songId ? "local" : songExternalId ? "jamendo" : "local");
        const songTitle = req.body.songTitle?.trim() || "";
        const songArtistName = req.body.songArtistName?.trim() || "";
        const songPosterUrl = req.body.songPosterUrl?.trim() || "";

        if (!mood || !ALLOWED_MOODS.has(mood)) {
            return res.status(400).json({
                message: "mood must be one of: happy, sad, surprised",
                history: null,
            });
        }

        const history = await moodHistoryModel.create({
            userId: req.user.id,
            mood,
            expression,
            source,
            songId,
            songExternalId: songExternalId || null,
            songSource,
            songTitle,
            songArtistName,
            songPosterUrl,
        });

        return res.status(201).json({
            message: "mood history saved successfully",
            history: formatHistoryEntry(await history.populate("songId", "title url posterUrl mood")),
        });
    } catch (error) {
        console.error("recordMood failed", error);
        return res.status(500).json({
            message: "failed to save mood history",
            history: null,
        });
    }
}

async function getMoodHistory(req, res) {
    try {
        const limit = clampLimit(req.query.limit, 10, 50);

        const history = await moodHistoryModel
            .find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate("songId", "title url posterUrl mood");

        return res.status(200).json({
            message: "mood history retrieved successfully",
            history: history.map(formatHistoryEntry),
        });
    } catch (error) {
        console.error("getMoodHistory failed", error);
        return res.status(500).json({
            message: "failed to retrieve mood history",
            history: [],
        });
    }
}

async function getRecommendations(req, res) {
    try {
        const mood = normalizeMood(req.query.mood);
        const limit = clampLimit(req.query.limit, 6, 12);

        if (!mood || !ALLOWED_MOODS.has(mood)) {
            return res.status(400).json({
                message: "mood must be one of: happy, sad, surprised",
                playlist: [],
            });
        }

        const [recentHistory, localSongs, externalSongs] = await Promise.all([
            moodHistoryModel
                .find({ userId: req.user.id })
                .sort({ createdAt: -1 })
                .limit(5)
                .select("mood createdAt"),
            songModel.find().sort({ createdAt: -1 }).limit(100),
            fetchJamendoTracksForMood(mood, { limit: Math.max(limit * 2, 12) }),
        ]);

        const weights = buildMoodWeights(mood, recentHistory);
        const songs = combineSongPools(localSongs, externalSongs);

        const playlist = songs
            .map((song) => ({
                id: song.id || song._id || song.externalId || null,
                title: song.title,
                url: song.url,
                posterUrl: song.posterUrl || null,
                mood: song.mood,
                artistName: song.artistName || "",
                albumName: song.albumName || "",
                source: song.source || "local",
                createdAt: song.createdAt || song.releasedAt || null,
                reason: buildReason(song, mood, recentHistory),
                score: scoreSong(song, weights),
            }))
            .sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }

                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            })
            .slice(0, limit)
            .map(({ score, ...song }) => song);

        return res.status(200).json({
            message: "playlist generated successfully",
            currentMood: mood,
            playlist,
        });
    } catch (error) {
        console.error("getRecommendations failed", error);
        return res.status(500).json({
            message: "failed to generate playlist",
            playlist: [],
        });
    }
}

module.exports = {
    recordMood,
    getMoodHistory,
    getRecommendations,
};
