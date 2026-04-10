const JAMENDO_API_BASE = "https://api.jamendo.com/v3.0/tracks/";
const CACHE_TTL_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

const cache = new Map();

const MOOD_PROFILES = {
    happy: {
        search: "happy upbeat pop dance",
        tags: ["happy", "upbeat", "pop", "dance", "groove", "electronic"],
    },
    sad: {
        search: "sad acoustic ambient piano",
        tags: ["sad", "acoustic", "ambient", "piano", "melancholic", "reflective"],
    },
    surprised: {
        search: "surprised experimental indie electronic",
        tags: ["experimental", "indie", "electronic", "funk", "cinematic", "upbeat"],
    },
};

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

function buildJamendoParams(mood, limit) {
    const profile = MOOD_PROFILES[mood] || MOOD_PROFILES.happy;
    const params = new URLSearchParams({
        format: "json",
        limit: String(limit),
        include: "musicinfo",
        groupby: "artist_id",
        boost: "popularity_month",
        search: profile.search,
        fuzzytags: profile.tags.join(" "),
        audioformat: "mp31",
        imagesize: "300",
    });

    return params;
}

function normalizeJamendoTrack(track, mood) {
    if (!track?.audio || !track?.name) return null;

    return {
        id: String(track.id),
        externalId: String(track.id),
        source: "jamendo",
        title: track.name.trim(),
        url: track.audio,
        posterUrl: track.image || track.album_image || null,
        mood,
        artistName: track.artist_name || "",
        albumName: track.album_name || "",
        duration: track.duration || null,
        releasedAt: track.releasedate || null,
        createdAt: track.releasedate ? new Date(track.releasedate).toISOString() : new Date().toISOString(),
    };
}

async function fetchJamendoTracksForMood(mood, options = {}) {
    const clientId = process.env.JAMENDO_CLIENT_ID;
    if (!clientId) {
        return [];
    }

    const normalizedMood = normalizeMood(mood);
    if (!normalizedMood) {
        return [];
    }

    const limit = clampLimit(options.limit, 12, 50);
    const cacheKey = `${normalizedMood}:${limit}`;

    if (!options.forceRefresh) {
        const cached = cache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.tracks;
        }
    }

    if (typeof fetch !== "function") {
        console.warn("Global fetch is not available, skipping Jamendo lookup");
        return [];
    }

    const params = buildJamendoParams(normalizedMood, limit);
    params.set("client_id", clientId);

    const requestUrl = `${JAMENDO_API_BASE}?${params.toString()}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(requestUrl, { signal: controller.signal });

        if (!response.ok) {
            throw new Error(`Jamendo request failed with status ${response.status}`);
        }

        const payload = await response.json();
        const tracks = Array.isArray(payload?.results) ? payload.results : [];
        const normalizedTracks = tracks
            .map((track) => normalizeJamendoTrack(track, normalizedMood))
            .filter(Boolean);

        cache.set(cacheKey, {
            expiresAt: Date.now() + CACHE_TTL_MS,
            tracks: normalizedTracks,
        });

        return normalizedTracks;
    } catch (error) {
        if (error?.name !== "AbortError") {
            console.warn("Jamendo lookup failed", error.message);
        }

        return [];
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = {
    fetchJamendoTracksForMood,
};
