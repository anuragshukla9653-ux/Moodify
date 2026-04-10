const mongoose = require("mongoose");
const { MemoryQuery, createHybridModel, createMemoryRecord, memoryStore } = require("../config/runtime-store");

const blacklistSchema = new mongoose.Schema({
    token: {
        type: String,
        required: [ true, "Token is required for blacklisting" ],
    }
}, {
    timestamps: true
})

const mongooseModel = mongoose.models.blacklist || mongoose.model("blacklist", blacklistSchema);

const memoryAdapter = {
    create(data) {
        return createMemoryRecord("blacklists", data);
    },
    findOne(filter = {}) {
        return new MemoryQuery({
            collection: () => memoryStore.blacklists,
            filter,
            single: true,
        });
    },
    find(filter = {}) {
        return new MemoryQuery({
            collection: () => memoryStore.blacklists,
            filter,
            single: false,
        });
    },
};

module.exports = createHybridModel(mongooseModel, memoryAdapter);
