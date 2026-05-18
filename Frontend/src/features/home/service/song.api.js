import axios from "axios";

const api = axios.create({
    baseURL: "https://moodify-1-hk4g.onrender.com/api",
    withCredentials: true
})

export async function getSong({mood}) {
    const response = await api.get("/api/songs?mood=" + mood)
    return response.data
}

export async function recordMood({
    mood,
    expression = "",
    source = "camera",
    songId = null,
    songExternalId = null,
    songSource = "local",
    songTitle = "",
    songArtistName = "",
    songPosterUrl = "",
}) {
    const response = await api.post("/api/moods/history", {
        mood,
        expression,
        source,
        songId,
        songExternalId,
        songSource,
        songTitle,
        songArtistName,
        songPosterUrl,
    })

    return response.data
}

export async function getMoodHistory(limit = 8) {
    const response = await api.get(`/api/moods/history?limit=${limit}`)
    return response.data
}

export async function getMoodRecommendations({ mood, limit = 6 }) {
    const response = await api.get(`/api/moods/recommendations?mood=${mood}&limit=${limit}`)
    return response.data
}
