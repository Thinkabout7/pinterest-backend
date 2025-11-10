// routes/notificationRoutes.js
import express from "express";
import Notification from "../models/Notification.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// 📬 Get all notifications for current user
router.get("/", protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate("sender", "username profilePicture")
      .populate("pin", "title mediaUrl")
      .sort({ createdAt: -1 });

    res.status(200).json(notifications);
  } catch (err) {
    console.error("Notification fetch error:", err);
    res.status(500).json({ message: err.message });
  }
});

// 🔴 Get unread notification count
router.get("/unread/count", protect, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });
    res.status(200).json({ unreadCount: count });
  } catch (err) {
    console.error("Unread count error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Mark notification as read
router.put("/:id/read", protect, async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true },
      { new: true }
    );
    if (!notif) return res.status(404).json({ message: "Notification not found" });

    res.status(200).json({ message: "Notification marked as read" });
  } catch (err) {
    console.error("Mark read error:", err);
    res.status(500).json({ message: err.message });
  }
});

// 🗑 Delete a single notification
router.delete("/:id", protect, async (req, res) => {
  try {
    await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user._id,
    });
    res.status(200).json({ message: "Notification deleted" });
  } catch (err) {
    console.error("Notification delete error:", err);
    res.status(500).json({ message: err.message });
  }
});

// 🧹 Clear all notifications
router.delete("/", protect, async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user._id });
    res.status(200).json({ message: "All notifications cleared" });
  } catch (err) {
    console.error("Clear all notifications error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;