import express from "express";
import SavedPin from "../models/SavedPin.js";
import Pin from "../models/Pin.js";
import User from "../models/User.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// ---------- SAVE a pin ----------
router.post("/:pinId/save", protect, async (req, res) => {
  try {
    const { pinId } = req.params;
    const userId = req.user._id;

    const pin = await Pin.findById(pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    // check if already saved
    const alreadySaved = await SavedPin.findOne({ user: userId, pin: pinId });
    if (alreadySaved)
      return res.status(400).json({ message: "Pin already saved" });

    const saved = await SavedPin.create({ user: userId, pin: pinId });
    res.status(201).json({ message: "Pin saved successfully", saved });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------- UNSAVE a pin ----------
router.delete("/:pinId/unsave", protect, async (req, res) => {
  try {
    const { pinId } = req.params;
    const userId = req.user._id;

    const removed = await SavedPin.findOneAndDelete({ user: userId, pin: pinId });
    if (!removed)
      return res.status(404).json({ message: "This pin was not saved" });

    res.status(200).json({ message: "Pin unsaved successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------- GET all saved pins for a specific user ----------
router.get("/:username/saved", async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username });

    if (!user) return res.status(404).json({ message: "User not found" });

    const savedPins = await SavedPin.find({ user: user._id })
      .populate({
        path: "pin",
        populate: { path: "user", select: "username profilePicture" },
      })
      .sort({ savedAt: -1 });

    // Return just the pin objects
    res.status(200).json(savedPins.map((s) => s.pin));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;