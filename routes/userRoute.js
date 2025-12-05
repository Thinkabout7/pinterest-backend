// routes/userRoute.js
import express from "express";
import User from "../models/User.js";
import Pin from "../models/Pin.js";
import Board from "../models/Board.js";
import SavedPin from "../models/SavedPin.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// ----------------------------------------------------
// GET all users (hide deactivated/deleted)
// ----------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const users = await User.find({
      isDeleted: false,
      isDeactivated: false,
    })
      .select("_id username email profilePicture followers following createdAt")
      .sort({ createdAt: -1 });

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ----------------------------------------------------
// GET logged-in user's own profile
// ----------------------------------------------------
router.get("/me/profile", protect, async (req, res) => {
  try {
    const me = await User.findById(req.user._id)
      .select("_id username email profilePicture followers following createdAt isDeactivated")
      .populate("followers", "username profilePicture")
      .populate("following", "username profilePicture");

    if (!me) return res.status(404).json({ message: "User not found" });

    res.status(200).json(me);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ----------------------------------------------------
// Check if current user follows someone
// ----------------------------------------------------
router.get("/:id/is-following", protect, async (req, res) => {
  try {
    if (req.user.isDeactivated)
      return res.status(403).json({ message: "Account is deactivated" });

    const me = await User.findById(req.user._id);
    const isFollowing = me.following.includes(req.params.id);

    res.status(200).json({ isFollowing });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ----------------------------------------------------
// GET USER PROFILE BY USERNAME
// ----------------------------------------------------
router.get("/:username", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select("_id username email profilePicture followers following createdAt isDeleted isDeactivated");

    if (!user || user.isDeleted) {
      return res.status(404).json({ message: "User not found" });
    }

    // hide deactivated profile
    if (user.isDeactivated) {
      return res.status(404).json({ message: "User not found" });
    }

    const pins = await Pin.find({
      user: user._id,
    })
      .populate({
        path: "user",
        select: "username profilePicture",
        match: { isDeleted: false, isDeactivated: false },
      })
      .sort({ createdAt: -1 });

    // Remove pins if owner is filtered out
    const visiblePins = pins.filter((p) => p.user);

    res.status(200).json({
      user,
      pins: visiblePins,
      followersCount: user.followers.length,
      followingCount: user.following.length,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ----------------------------------------------------
// GET USER BOARDS
// ----------------------------------------------------
router.get("/:username/boards", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });

    if (!user || user.isDeleted || user.isDeactivated) {
      return res.status(404).json({ message: "User not found" });
    }

    const boards = await Board.find({ user: user._id })
      .populate({
        path: "pins",
        populate: { path: "user", select: "username profilePicture isDeleted isDeactivated" },
      })
      .sort({ createdAt: -1 });

    // hide pins from deactivated/deleted users
    const cleanedBoards = boards.map((board) => ({
      ...board.toObject(),
      pins: board.pins.filter((p) => p.user && !p.user.isDeleted && !p.user.isDeactivated),
    }));

    res.status(200).json(cleanedBoards);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ----------------------------------------------------
// GET USER SAVED PINS
// ----------------------------------------------------
router.get("/:username/saved-pins", async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });

    if (!user || user.isDeleted || user.isDeactivated) {
      return res.status(404).json({ message: "User not found" });
    }

    const savedPins = await SavedPin.find({ user: user._id })
      .populate({
        path: "pin",
        populate: { path: "user", select: "username profilePicture isDeleted isDeactivated" },
      })
      .sort({ savedAt: -1 });

    const visiblePins = savedPins
      .map((s) => s.pin)
      .filter((p) => p && p.user && !p.user.isDeleted && !p.user.isDeactivated);

    res.status(200).json(visiblePins);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ----------------------------------------------------
// Update user profile
// ----------------------------------------------------
router.put("/:id", protect, async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: "You can only update your own profile" });
    }

    if (req.user.isDeactivated)
      return res.status(403).json({ message: "Account is deactivated" });

    const { username, email, profilePicture } = req.body;

    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (profilePicture !== undefined)
      updateData.profilePicture = profilePicture;

    const updatedUser = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });

    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// ----------------------------------------------------
// GET ACCOUNT STATUS
// ----------------------------------------------------
router.get("/:id/status", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "isDeactivated isDeleted"
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      isDeactivated: user.isDeactivated,
      isDeleted: user.isDeleted,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;
