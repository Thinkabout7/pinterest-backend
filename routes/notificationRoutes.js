// routes/notificationRoutes.js
import express from "express";
import Notification from "../models/Notification.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// 📬 Get all notifications for current user
router.get("/", protect, async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user._id,
    })
      .populate("sender", "username avatar")
      .populate("pin", "title mediaUrl")
      .sort({ createdAt: -1 });

    res.status(200).json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Mark notification as read
router.put("/:id/read", protect, async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif) return res.status(404).json({ message: "Not found" });

    notif.isRead = true;
    await notif.save();
    res.status(200).json({ message: "Notification marked as read" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🗑 Clear all notifications
router.delete("/", protect, async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user._id });
    res.status(200).json({ message: "All notifications cleared" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
