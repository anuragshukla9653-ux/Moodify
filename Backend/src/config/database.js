const mongoose = require('mongoose');

async function connectToDB() {
    const mongoUri = process.env.MONGO_URI;
    const dbName = process.env.MONGO_DB_NAME;

    if (!mongoUri) {
        throw new Error("MONGO_URI is not defined in the environment");
    }

    try {
        const connectOptions = {};

        if (dbName) {
            connectOptions.dbName = dbName;
        }

        await mongoose.connect(mongoUri, connectOptions);
        console.log(`Connected to MongoDB${dbName ? ` (${dbName})` : ""}`);
    } catch (err) {
        console.log("Error connecting to MongoDB", err);
        throw err;
    }
}

module.exports = connectToDB;
        
