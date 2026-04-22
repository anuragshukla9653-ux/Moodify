const userModel = require("../models/user.model.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
// const redis = require("../config/cache.js")

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function buildCookieOptions(maxAge) {
    return {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge,
    };
}

async function registerUser(req, res) {
    try {
        const username = normalizeText(req.body?.username);
        const email = normalizeText(req.body?.email).toLowerCase();
        const password = normalizeText(req.body?.password);

        if (!username || !email || !password) {
            return res.status(400).json({
                message: "username, email and password are required",
            });
        }

        const isAlreadyRegistered = await userModel.findOne({
            $or: [
                { email },
                { username },
            ],
        });

        if (isAlreadyRegistered) {
            return res.status(400).json({
                message: "User with this email or username already exists",
            });
        }

        const hash = await bcrypt.hash(password, 10);

        const user = await userModel.create({
            username,
            email,
            password: hash,
        });

        const token = jwt.sign(
            {
                id: user._id,
                username: user.username,
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.cookie("token", token, buildCookieOptions(7 * 24 * 60 * 60 * 1000));
        return res.status(201).json({
            message: "User registered successfully",
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
            },
        });
    } catch (error) {
        console.error("registerUser failed", error);
        return res.status(500).json({
            message: "Failed to register user",
        });
    }
}

async function loginUser(req, res) {
    try {
        const email = normalizeText(req.body?.email).toLowerCase();
        const username = normalizeText(req.body?.username);
        const password = normalizeText(req.body?.password);

        if (!password || (!email && !username)) {
            return res.status(400).json({
                message: "email/username and password are required",
            });
        }

        const identifiers = [];
        if (email) {
            identifiers.push({ email });
        }

        if (username) {
            identifiers.push({ username });
        }

        const user = await userModel.findOne({ $or: identifiers }).select("+password");
        if (!user) {
            return res.status(400).json({
                message: "Invalid email/username or password",
            });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(400).json({
                message: "Invalid email/username or password",
            });
        }

        const token = jwt.sign(
            {
                id: user._id,
                username: user.username,
            },
            process.env.JWT_SECRET,
            { expiresIn: "3d" }
        );

        res.cookie("token", token, buildCookieOptions(3 * 24 * 60 * 60 * 1000));
        return res.status(200).json({
            message: "User logged in successfully",
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
            },
        });
    } catch (error) {
        console.error("loginUser failed", error);
        return res.status(500).json({
            message: "Failed to login user",
        });
    }
}

async function getMe(req, res) {
    try {
        const user = await userModel.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        return res.status(200).json({
            message: "User data retrieved successfully",
            user,
        });
    } catch (error) {
        console.error("getMe failed", error);
        return res.status(500).json({
            message: "Failed to fetch user profile",
        });
    }
}

async function logoutUser(req, res) {
    try {
        const token = req.cookies.token;

        res.clearCookie("token", buildCookieOptions(0));

        // if (token) {
        //     await redis.set(token, Date.now().toString())
        // }

        return res.status(200).json({
            message: "logout successfully.",
        });
    } catch (error) {
        console.error("logoutUser failed", error);
        return res.status(500).json({
            message: "Failed to logout user",
        });
    }
}
module.exports = {
    registerUser,
    loginUser,
    getMe,
    logoutUser
};
