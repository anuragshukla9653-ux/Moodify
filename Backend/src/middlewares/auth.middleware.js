const redis = require("../config/cache.js")

const jwt = require("jsonwebtoken");

async function authUser(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({
            message: "Token not provided"
        })
    }

    const isTokenBlacklisted = await redis.get(token)

    if (isTokenBlacklisted) {
        return res.status(401).json({
            message: "Token has been revoked"
        });
    }

    try {

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET,
        )

        req.user = decoded
        
        next();
    } catch (error) {
        return res.status(401).json({
            message: "Invalid token"
        });
    }
}

module.exports = { authUser }
