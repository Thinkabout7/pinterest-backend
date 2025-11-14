// routes/likeRoutes.js
import express from "express";
import Like from "../models/Like.js";
import Pin from "../models/Pin.js";
import protect from "../middleware/authMiddleware.js";
import Notification from "../models/Notification.js";

const router = express.Router();

// ❤️ Like a pin
router.post("/:pinId", protect, async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    // prevent duplicate likes
    const existing = await Like.findOne({ user: req.user._id, pin: pin._id });
    if (existing) return res.status(400).json({ message: "Already liked" });

    const like = await Like.create({ user: req.user._id, pin: pin._id });

    // 🔔 Notify the pin owner (only if not liking own pin)
    if (pin.user.toString() !== req.user._id.toString()) {
      await Notification.create({
        recipient: pin.user,
        sender: req.user._id,
        type: "like",
        pin: pin._id,
        message: `${req.user.username} liked your pin "${pin.title}".`,
      });
    }

    res.status(201).json(like);
  } catch (err) {
    console.error("Like error:", err);
    res.status(500).json({ message: err.message });
  }
});

// 💔 Unlike a pin
router.delete("/:pinId", protect, async (req, res) => {
  try {
    const like = await Like.findOneAndDelete({
      user: req.user._id,
      pin: req.params.pinId,
    });

    if (!like) return res.status(404).json({ message: "Like not found" });
    res.status(200).json({ message: "Unliked successfully" });
  } catch (err) {
    console.error("Unlike error:", err);
    res.status(500).json({ message: err.message });
  }
});

// 🔢 Get like count for a pin
router.get("/:pinId", async (req, res) => {
  try {
    const count = await Like.countDocuments({ pin: req.params.pinId });
    res.status(200).json({ pinId: req.params.pinId, likes: count });
  } catch (err) {
    console.error("Like count error:", err);
    res.status(500).json({ message: err.message });
  }
});

// -----------------------------------------------
// 🔥 COMPATIBILITY ALIAS ROUTES FOR FRONTEND
// -----------------------------------------------

// Frontend calls: POST /api/pins/:pinId/like
router.post("/pins/:pinId/like", protect, async (req, res, next) => {
  req.url = `/${req.params.pinId}`;
  router.handle(req, res, next);
});

// Frontend calls: DELETE /api/pins/:pinId/like
router.delete("/pins/:pinId/like", protect, async (req, res, next) => {
  req.url = `/${req.params.pinId}`;
  router.handle(req, res, next);
});

// Frontend calls: GET /api/pins/:pinId/like
router.get("/pins/:pinId/like", async (req, res, next) => {
  req.url = `/${req.params.pinId}`;
  router.handle(req, res, next);
});

export default router;
