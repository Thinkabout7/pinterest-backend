import express from "express";
import Pin from "../models/Pin.js";
import protect from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js"; // ✅ new
import { autoAssignCover } from "../controllers/boardController.js";
import axios from "axios";
import Like from "../models/Like.js";
import Notification from "../models/Notification.js";

const router = express.Router();

// ---------- CREATE a new Pin (supports image or short video) ----------
router.post("/", protect, upload.single("media"), async (req, res) => {
  try {
    const { title, description, category, boardId } = req.body;

    // Cloudinary upload check
    if (!req.file?.path) {
      return res.status(400).json({ message: "Media file is required (image or video)" });
    }

    // Detect file type
    const mediaType = /^video\//i.test(req.file.mimetype) ? "video" : "image";

    const newPin = new Pin({
      title,
      description,
      category,
      mediaUrl: req.file.path, // ✅ full Cloudinary URL
      mediaType,               // ✅ image or video
      user: req.user._id,
      boardId,
    });

    const savedPin = await newPin.save();

    // Auto-assign cover to boards if needed
    if (boardId) {
      await autoAssignCover(boardId, req.file.path);
    }

    res.status(201).json(savedPin);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// ---------- GET all Pins (public) ----------
router.get("/", async (req, res) => {
  try {
    const pins = await Pin.find()
      .populate("user", "username email profilePicture") // show user info
      .sort({ createdAt: -1 });
    res.status(200).json(pins);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------- UPDATE a Pin (only owner) ----------
router.put("/:id", protect, async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.id);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    if (pin.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const updatedPin = await Pin.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    res.status(200).json(updatedPin);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------- GET single Pin by ID ----------
router.get("/:id", async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.id)
      .populate("user", "username email profilePicture");
    
    if (!pin) {
      return res.status(404).json({ message: "Pin not found" });
    }
    
    res.status(200).json(pin);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});










// ---------- DELETE a Pin (only owner) ----------
router.delete("/:id", protect, async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.id);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    if (pin.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await pin.deleteOne();
    res.status(200).json({ message: "Pin deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------- DOWNLOAD Pin Image ----------
router.get("/:pinId/download", async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    const response = await axios.get(pin.mediaUrl, { responseType: 'stream' });
    const contentType = pin.mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
    const filename = `pin-${pin._id}.${pin.mediaType === 'video' ? 'mp4' : 'jpg'}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.data.pipe(res);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------- LIKE a Pin ----------
router.post("/:pinId/like", protect, async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    const existing = await Like.findOne({ user: req.user._id, pin: pin._id });
    if (existing) return res.status(400).json({ message: "Already liked" });

    await Like.create({ user: req.user._id, pin: pin._id });

    if (pin.user.toString() !== req.user._id.toString()) {
      await Notification.create({
        recipient: pin.user,
        sender: req.user._id,
        type: "like",
        pin: pin._id,
        message: `${req.user.username} liked your pin "${pin.title}".`,
      });
    }

    const count = await Like.countDocuments({ pin: pin._id });
    res.status(201).json({ success: true, liked: true, count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------- UNLIKE a Pin ----------
router.delete("/:pinId/like", protect, async (req, res) => {
  try {
    const like = await Like.findOneAndDelete({
      user: req.user._id,
      pin: req.params.pinId,
    });

    if (!like) return res.status(404).json({ message: "Like not found" });

    const count = await Like.countDocuments({ pin: req.params.pinId });
    res.status(200).json({ success: true, liked: false, count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------- GET Users Who Liked a Pin ----------
router.get("/:pinId/likes", async (req, res) => {
  try {
    const likes = await Like.find({ pin: req.params.pinId }).populate("user", "username profilePicture");
    const users = likes.map(like => like.user);
    const count = users.length;
    res.status(200).json({ count, users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
