// routes/commentRoutes.js
import express from "express";
import Comment from "../models/Comment.js";
import Pin from "../models/Pin.js";
import protect from "../middleware/authMiddleware.js";
import Notification from "../models/Notification.js";

const router = express.Router();

// 📝 Create comment on a Pin
router.post("/:pinId", protect, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: "Text is required" });

    const pin = await Pin.findById(req.params.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    const comment = await Comment.create({
      text,
      user: req.user._id,
      pin: pin._id,
    });

    // 🔔 Notify pin owner
    if (pin.user.toString() !== req.user._id.toString()) {
      await Notification.create({
        recipient: pin.user,
        sender: req.user._id,
        type: "comment",
        pin: pin._id,
        message: `${req.user.username} commented on your pin "${pin.title}".`,
      });
    }

    const populated = await comment.populate("user", "username email profilePicture");
    res.status(201).json(populated);
  } catch (err) {
    console.error("Comment create error:", err);
    res.status(500).json({ message: err.message });
  }
});

// 💬 Get all comments for a Pin
router.get("/:pinId", async (req, res) => {
  try {
    const comments = await Comment.find({ pin: req.params.pinId })
      .populate("user", "username email profilePicture")
      .sort({ createdAt: -1 });

    res.status(200).json(comments);
  } catch (err) {
    console.error("Comment fetch error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ❌ Delete comment (only owner)
router.delete("/:id", protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    if (comment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await comment.deleteOne();
    res.status(200).json({ message: "Comment deleted successfully" });
  } catch (err) {
    console.error("Comment delete error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
