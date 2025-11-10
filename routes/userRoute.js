// routes/userRoutes.js
import express from "express";
import User from "../models/User.js";
import Pin from "../models/Pin.js";
import Board from "../models/Board.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();


//  GET all users ----------
router.get("/", async (req, res) => {
  try {
    const users = await User.find()
      .select("_id username email profilePicture followers following createdAt")
      .sort({ createdAt: -1 });

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


//  Get your own profile (secure) ----------
router.get("/me/profile", protect, async (req, res) => {
  try {
    const me = await User.findById(req.user._id)
      .select("_id username email profilePicture followers following createdAt")
      .populate("followers", "username profilePicture")
      .populate("following", "username profilePicture");

    if (!me) return res.status(404).json({ message: "User not found" });
    res.status(200).json(me);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


// Check if current user follows another user ----------
router.get("/:id/is-following", protect, async (req, res) => {
  try {
    const me = await User.findById(req.user._id);
    const isFollowing = me.following.includes(req.params.id);
    res.status(200).json({ isFollowing });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


// Get user by username ----------
router.get("/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select("_id username email profilePicture followers following createdAt");

    if (!user) return res.status(404).json({ message: "User not found" });

    const pins = await Pin.find({ user: user._id })
      .populate("user", "username profilePicture")
      .sort({ createdAt: -1 })
      .select("title mediaUrl mediaType");

    res.status(200).json({
      user,
      pins,
      followersCount: user.followers.length,
      followingCount: user.following.length,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


//Get user's boards ----------
router.get("/:username/boards", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: "User not found" });

    const boards = await Board.find({ user: user._id })
      .populate("user", "username profilePicture")
      .populate("pins")
      .sort({ createdAt: -1 });

    res.status(200).json(boards);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;