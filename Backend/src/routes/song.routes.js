const express = require("express")
const upload = require("../middlewares/upload.middleware")
const songController = require("../controllers/song.controller")


const router = express.Router()

router.post(
    "/",
    upload.fields([
        { name: "song", maxCount: 1 },
        { name: "poster", maxCount: 1 },
        { name: "image", maxCount: 1 },
    ]),
    songController.uploadSong
)

router.get("/", songController.getSongs)
router.get("/recommendations", songController.getRecommendations)

module.exports = router
