// routes/feedRoutes.js
import express from "express";
import Pin from "../models/Pin.js";
import User from "../models/User.js";
import Like from "../models/Like.js";
import Comment from "../models/Comment.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// 📜 Get feed pins (from followed users + self, fallback to global)
router.get("/", protect, async (req, res) => {
  try {
    const me = await User.findById(req.user._id);
    if (!me) return res.status(404).json({ message: "User not found" });

    const userIds = [...me.following, req.user._id];

    // If user follows nobody, show global feed instead
    const filter = userIds.length > 0 ? { user: { $in: userIds } } : {};

    const pins = await Pin.find(filter)
      .populate("user", "username profilePicture")
      .sort({ createdAt: -1 });

    // Optional: enrich each pin with like/comment counts
    const enriched = await Promise.all(
      pins.map(async (pin) => {
        const [likes, comments] = await Promise.all([
          Like.countDocuments({ pin: pin._id }),
          Comment.countDocuments({ pin: pin._id }),
        ]);
        return {
          ...pin.toObject(),
          likesCount: likes,
          commentsCount: comments,
        };
      })
    );

    res.status(200).json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;