const mongoose = require("mongoose");
const { MemoryQuery, createHybridModel, createMemoryRecord, memoryStore, normalizeId, pickFields } = require("../config/runtime-store");

const moodHistorySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        mood: {
            type: String,
            enum: {
                values: ["happy", "sad", "surprised"],
                message: "Mood must be happy, sad, or surprised",
            },
            required: true,
        },
        expression: {
            type: String,
            default: "",
        },
        source: {
            type: String,
            enum: {
                values: ["camera", "manual", "playlist"],
                message: "Source must be camera, manual, or playlist",
            },
            default: "camera",
        },
        songId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "songs",
            default: null,
        },
        songExternalId: {
            type: String,
            default: null,
        },
        songSource: {
            type: String,
            enum: {
                values: ["local", "jamendo"],
                message: "Song source must be local or jamendo",
            },
            default: "local",
        },
        songTitle: {
            type: String,
            default: "",
        },
        songArtistName: {
            type: String,
            default: "",
        },
        songPosterUrl: {
            type: String,
            default: "",
        },
    },
    { timestamps: true }
);

moodHistorySchema.index({ userId: 1, createdAt: -1 });

const mongooseModel = mongoose.models.MoodHistory || mongoose.model("MoodHistory", moodHistorySchema);

function resolveSongPopulation(doc, path, fields) {
    if (path !== "songId") {
        return undefined;
    }

    const songId = normalizeId(doc.songId);
    if (!songId) {
        return null;
    }

    const song = memoryStore.songs.find((entry) => normalizeId(entry._id) === songId);
    if (!song) {
        return null;
    }

    return pickFields(song, fields);
}

const memoryAdapter = {
    create(data) {
        return createMemoryRecord("moods", data, { populateResolver: resolveSongPopulation });
    },
    find(filter = {}) {
        return new MemoryQuery({
            collection: () => memoryStore.moods,
            filter,
            single: false,
            populateResolver: resolveSongPopulation,
        });
    },
};

module.exports = createHybridModel(mongooseModel, memoryAdapter);
