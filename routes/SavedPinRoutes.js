// routes/SavedPinRoutes.js
import express from "express";
import SavedPin from "../models/SavedPin.js";
import Pin from "../models/Pin.js";
import User from "../models/User.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

/* --------------------------------------------------
    SAVE TO PROFILE  (frontend expects THIS!)
   -------------------------------------------------- */
router.post("/profile/:pinId", protect, async (req, res) => {
  try {
    const { pinId } = req.params;
    const userId = req.user._id;

    const pin = await Pin.findById(pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    const alreadySaved = await SavedPin.findOne({ user: userId, pin: pinId });
    if (alreadySaved)
      return res.status(400).json({ message: "Pin already saved" });

    const saved = await SavedPin.create({ user: userId, pin: pinId });

    res.status(201).json({
      message: "Pin saved to profile",
      saved,
    });
  } catch (error) {
    console.error("Save to profile error:", error);
    res.status(500).json({ message: error.message });
  }
});

/* --------------------------------------------------
    UNSAVE FROM PROFILE
   -------------------------------------------------- */
router.delete("/profile/:pinId", protect, async (req, res) => {
  try {
    const { pinId } = req.params;
    const userId = req.user._id;

    const removed = await SavedPin.findOneAndDelete({ user: userId, pin: pinId });
    if (!removed)
      return res.status(404).json({ message: "Pin was not saved" });

    res.json({ message: "Pin removed from profile" });
  } catch (error) {
    console.error("Unsave error:", error);
    res.status(500).json({ message: error.message });
  }
});

/* --------------------------------------------------
    CHECK IF PIN IS SAVED
   -------------------------------------------------- */
router.get("/profile/:pinId/check", protect, async (req, res) => {
  try {
    const { pinId } = req.params;

    const exists = await SavedPin.findOne({
      user: req.user._id,
      pin: pinId,
    });

    res.json({ isSaved: !!exists });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* --------------------------------------------------
    GET ALL SAVED PINS FOR A USER
   -------------------------------------------------- */
router.get("/:username/saved-pins", async (req, res) => {
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

    res.status(200).json(savedPins.map((s) => s.pin));
  } catch (error) {
    console.error("Get saved pins error:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
