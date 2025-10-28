// routes/profileRoutes.js
import express from "express";
import User from "../models/User.js";
import Pin from "../models/Pin.js";
import Board from "../models/Board.js";

const router = express.Router();

// 👤 Get public profile info
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("followers", "username avatar")
      .populate("following", "username avatar");

    if (!user) return res.status(404).json({ message: "User not found" });

    const pins = await Pin.find({ user: user._id }).sort({ createdAt: -1 });
    const boards = await Board.find({ user: user._id }).sort({ createdAt: -1 });

    res.status(200).json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        followersCount: user.followers.length,
        followingCount: user.following.length,
      },
      pins,
      boards,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
