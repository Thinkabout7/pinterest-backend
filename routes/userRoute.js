import express from "express";
import User from "../models/User.js";
import Pin from "../models/Pin.js";
import Board from "../models/Board.js";

const router = express.Router();


// ---------- GET all users ----------
router.get("/", async (req, res) => {
  try {
    const users = await User.find()
      .select("_id username email profilePicture followers following createdAt")
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});







// ---------- Get user by username ----------
router.get("/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select("_id username email profilePicture followers following createdAt");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      profilePicture: user.profilePicture || null,
      followers: user.followers?.length || 0,
      following: user.following?.length || 0,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ---------- Get user's created pins ----------
router.get("/:username/pins", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const pins = await Pin.find({ user: user._id })
      .populate("user", "username profilePicture")
      .sort({ createdAt: -1 });

    res.json(pins);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ---------- Get user's boards ----------
router.get("/:username/boards", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const boards = await Board.find({ user: user._id })
      .populate("user", "username profilePicture")
      .populate("pins")
      .sort({ createdAt: -1 });

    res.json(boards);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;