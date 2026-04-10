const userModel = require("../models/user.model.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const redis = require("../config/cache.js")

async function registerUser(req, res) {
    const { username, email, password } = req.body;

    const isAlreadyRegistered = await userModel.findOne({
        $or: [
            { email },
            { username }
        ]
    })

    if (isAlreadyRegistered) {
        return res.status(400).json({
            message: "User with this email or username already exists"
        })
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await userModel.create({
        username,
        email,
        password: hash
    })

    const token = jwt.sign({
        id: user._id,
        username: user.username
    }, process.env.JWT_SECRET, { expiresIn: '3d' });

    res.cookie("token", token)
    return res.status(201).json({
        message: "User registered successfully",
        user: {
            id: user._id,
            username: user.username,
            email: user.email
        }
    })
}

async function loginUser(req, res) {
    const { email, password, username } = req.body;
    const user = await userModel.findOne({
        $or: [
            { email },
            { username }
        ]
    }).select("+password");
    if (!user) {
        return res.status(400).json({
            message: "Invalid "
        })
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
        return res.status(400).json({
            message: "Invalid credentials"
        })
    }

    const token = jwt.sign({
        id: user._id,
        username: user.username
    }, process.env.JWT_SECRET, { expiresIn: '3d' });

    res.cookie("token", token);
    return res.status(200).json({
        message: "User logged in successfully",
        user: {
            id: user._id,
            username: user.username,
            email: user.email
        }
    });
}

async function getMe(req, res) {
    const user = await userModel.findById(req.user.id);

    res.status(200).json({
        message: "User data retrieved successfully",
        user
    })
}

async function logoutUser(req, res) {
    const token = req.cookies.token

    res.clearCookie("token")

    if (token) {
        await redis.set(token, Date.now().toString())
    }

    return res.status(200).json({
        message: "logout successfully."
    })
}
module.exports = {
    registerUser,
    loginUser,
    getMe,
    logoutUser
};
