const mongoose = require("mongoose");
const { MemoryQuery, createHybridModel, createMemoryRecord, memoryStore, normalizeId } = require("../config/runtime-store");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [ true, "Username is required" ],
        unique: [true, "Username must be unique"]
    },
    email: {
        type: String,
        required: [true, "Email is required" ],
        unique: [true, "Email must be unique" ]
    },
    password: {
        type: String,
        required: [true, "Password is required" ],
        select: false
    }
})

// userSchema.pre('save', function(next) {})
// userSchema.post('save', function(next) {})

const mongooseModel = mongoose.models.User || mongoose.model("User", userSchema);

const memoryAdapter = {
    create(data) {
        return createMemoryRecord("users", data);
    },
    findOne(filter = {}) {
        return new MemoryQuery({
            collection: () => memoryStore.users,
            filter,
            single: true,
        });
    },
    findById(id) {
        return new MemoryQuery({
            collection: () => memoryStore.users,
            filter: { _id: normalizeId(id) },
            single: true,
        });
    },
};

module.exports = createHybridModel(mongooseModel, memoryAdapter);
