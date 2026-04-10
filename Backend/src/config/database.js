const mongoose = require('mongoose');
const { enableMemoryDb, useMemoryDb } = require("./runtime-store");

async function connectToDB() {
    const mongoUri = process.env.MONGO_URI;
    const dbName = process.env.MONGO_DB_NAME;
    const timeoutMs = Number.parseInt(process.env.MONGO_CONNECT_TIMEOUT_MS || "4000", 10);

    if (!mongoUri) {
        enableMemoryDb("MONGO_URI is not defined in the environment");
        console.warn("MONGO_URI is not defined; starting in memory mode");
        return null;
    }

    try {
        const connectOptions = {};

        if (dbName) {
            connectOptions.dbName = dbName;
        }

        connectOptions.serverSelectionTimeoutMS = 2000;
        connectOptions.connectTimeoutMS = 2000;
        connectOptions.socketTimeoutMS = 2000;

        const connectPromise = mongoose.connect(mongoUri, connectOptions);
        const safeConnectPromise = connectPromise
            .then(() => true)
            .catch((error) => {
                if (useMemoryDb()) {
                    return false;
                }

                throw error;
            });
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => resolve(false), timeoutMs);
        });

        const connected = await Promise.race([safeConnectPromise, timeoutPromise]);

        if (!connected) {
            enableMemoryDb(`MongoDB connection timed out after ${timeoutMs}ms`);
            console.warn(`MongoDB connection timed out after ${timeoutMs}ms; starting in memory mode`);
            return null;
        }

        console.log(`Connected to MongoDB${dbName ? ` (${dbName})` : ""}`);
        return mongoose.connection;
    } catch (err) {
        console.warn("MongoDB unavailable; starting in memory mode", err.message);
        enableMemoryDb(err.message);
        return null;
    }
}

module.exports = connectToDB;
        
