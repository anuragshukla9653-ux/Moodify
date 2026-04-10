const mongoose = require("mongoose");
const { MemoryQuery, createHybridModel, createMemoryRecord, memoryStore } = require("../config/runtime-store");

const songSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true
    },
    posterUrl: {
        type: String,
        required: false,
    },
    title: {
        type: String,
        required: true,
    },
    mood: {
        type: String,
        enum: {
            values: ["happy", "sad", "surprised"],
            message: "Enum this is "
        }
    }
}, { timestamps: true })

const mongooseModel = mongoose.models.songs || mongoose.model("songs", songSchema);

const memoryAdapter = {
    create(data) {
        return createMemoryRecord("songs", data);
    },
    findOne(filter = {}) {
        return new MemoryQuery({
            collection: () => memoryStore.songs,
            filter,
            single: true,
        });
    },
    find(filter = {}) {
        return new MemoryQuery({
            collection: () => memoryStore.songs,
            filter,
            single: false,
        });
    },
};

module.exports = createHybridModel(mongooseModel, memoryAdapter);
