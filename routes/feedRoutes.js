// routes/feedRoutes.js
import express from "express";
import Pin from "../models/Pin.js";
import User from "../models/User.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// 📜 Get feed pins (from followed users + self)
router.get("/", protect, async (req, res) => {
  try {
    // find the current user
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // collect user IDs: people you follow + yourself
    const userIds = [...user.following, req.user._id];

    // get pins made by those users
    const pins = await Pin.find({ user: { $in: userIds } })
      .populate("user", "username avatar")
      .sort({ createdAt: -1 }); // newest first

    res.status(200).json(pins);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
