const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth.routes");
const songRoutes = require("./routes/song.routes");
const moodRoutes = require("./routes/mood.routes");

const app = express();

const allowedOrigins = [
    process.env.FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:5174",
].filter(Boolean);

const corsOptions = {
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/songs", songRoutes);
app.use("/api/moods", moodRoutes);

// Static files
app.use(express.static(path.join(__dirname, "../Public")));

// Catch-all route for SPA
app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../Public", "index.html"));
});

module.exports = app;
