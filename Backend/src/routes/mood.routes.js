const express = require("express");
const moodController = require("../controllers/mood.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

router.use(authMiddleware.authUser);

router.get("/history", moodController.getMoodHistory);
router.post("/history", moodController.recordMood);
router.get("/recommendations", moodController.getRecommendations);

module.exports = router;
