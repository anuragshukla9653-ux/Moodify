const songModel = require("../models/song.model") 
const storageService = require("../services/storage.service")
const id3 = require("node-id3")
const { fetchJamendoTracksForMood } = require("../services/jamendo.service")
const moodHistoryModel = require("../models/mood-history.model");

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

async function uploadSong(req, res) {
    try {
        const songUpload = req.file || req.files?.song?.[0]

        if (!songUpload?.buffer) {
            return res.status(400).json({
                message: "song file is required",
                song: null
            })
        }

        const mood = req.body.mood?.trim().toLowerCase()
        const allowedMoods = new Set(["happy", "sad", "surprised"])

        if (!mood) {
            return res.status(400).json({
                message: "mood is required",
                song: null
            })
        }

        if (!allowedMoods.has(mood)) {
            return res.status(400).json({
                message: "mood must be one of: happy, sad, surprised",
                song: null
            })
        }

        let tags = {}
        try {
            tags = id3.read(songUpload.buffer) || {}
        } catch (readError) {
            console.warn("Unable to read ID3 tags from uploaded song", readError.message)
        }

        const title =
            req.body.title?.trim() ||
            tags.title?.trim() ||
            songUpload.originalname?.replace(/\.[^.]+$/, "") ||
            `song-${Date.now()}`

        const posterUpload = req.files?.poster?.[0] || req.files?.image?.[0]
        const embeddedPoster = tags.image?.imageBuffer ? Buffer.from(tags.image.imageBuffer) : null
        const posterBuffer = posterUpload?.buffer || embeddedPoster
        const posterFileName = posterUpload?.originalname || `${title}.jpeg`

        const songFile = await storageService.uploadFile({
            buffer: songUpload.buffer,
            filename: songUpload.originalname || `${title}.mp3`,
            folder: "/cohort-2/moodify/songs",
            mimeType: songUpload.mimetype,
        })

        let posterFile = null
        if (posterBuffer) {
            try {
                posterFile = await storageService.uploadFile({
                    buffer: posterBuffer,
                    filename: posterFileName,
                    folder: "/cohort-2/moodify/posters",
                    mimeType: posterUpload?.mimetype || tags.image?.mime,
                })
            } catch (posterError) {
                console.warn("poster upload failed, saving song without poster", posterError.message)
            }
        }

        const song = await songModel.create({
            url: songFile.url,
            posterUrl: posterFile?.url ?? null,
            title,
            mood
        })

        res.status(201).json({
            message: "song uploaded successfully",
            song
        })
    } catch (error) {
        console.error("uploadSong failed", error)
        res.status(500).json({
            message: "failed to upload song",
            song: null
        })
    }
}

async function getSongs(req, res) {
    const mood = req.query.mood?.trim().toLowerCase()

    if (!mood) {
        return res.status(400).json({
            message: "mood is required",
            song: null
        })
    }

    const song = await songModel.findOne({ mood }).sort({ createdAt: -1 })

    if (song) {
        return res.status(200).json({
            message: "song retrieved successfully",
            song
        })
    }

    const externalSongs = await fetchJamendoTracksForMood(mood, { limit: 1 })
    const externalSong = externalSongs[0] || null

    if (externalSong) {
        return res.status(200).json({
            message: "song retrieved from external catalog successfully",
            song: externalSong
        })
    }

    return res.status(404).json({
        message: "song not found",
        song: null
    })
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
            req.user?.id
                ? moodHistoryModel
                      .find({ userId: req.user.id })
                      .sort({ createdAt: -1 })
                      .limit(5)
                      .select("mood createdAt")
                : [],
            songModel.find().sort({ createdAt: -1 }).limit(100),
            fetchJamendoTracksForMood(mood, { limit: Math.max(limit * 2, 12) }),
        ]);

        const weights = buildMoodWeights(mood, Array.isArray(recentHistory) ? recentHistory : []);
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
                reason: buildReason(song, mood, Array.isArray(recentHistory) ? recentHistory : []),
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


module.exports = { uploadSong, getSongs, getRecommendations } 
