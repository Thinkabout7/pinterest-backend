// routes/pinRoutes.js
import express from "express";
import Pin from "../models/Pin.js";
import protect from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";
import { autoAssignCover } from "../controllers/boardController.js";
import axios from "axios";
import Like from "../models/Like.js";
import Notification from "../models/Notification.js";
import Comment from "../models/Comment.js";
import CommentLike from "../models/CommentLike.js";
// ← ADD THIS LINE ONLY (exactly here or anywhere among imports)
import { generateImageTags } from "../helpers/geminiImageTags.js";

const router = express.Router();

/**
 * NOTE ABOUT Comment MODEL FOR THIS FILE
 * Your Comment schema MUST look conceptually like:
 *
 *  pinId: ObjectId (ref: "Pin")
 *  userId: ObjectId (ref: "User")
 *  text: String
 *  parentCommentId: ObjectId | null (ref: "Comment")
 *  likes: [ObjectId] (ref: "User")
 *
 * so that .pinId, .userId, .parentCommentId and .likes all exist.
 */

// ---------- CREATE a new Pin (supports image or short video) ----------
router.post("/", protect, upload.single("media"), async (req, res) => {
  try {
    const { title, description, category, boardId } = req.body;

    if (!req.file?.path) {
      return res
        .status(400)
        .json({ message: "Media file is required (image or video)" });
    }

    const mediaType = /^video\//i.test(req.file.mimetype) ? "video" : "image";

    const newPin = new Pin({
      title,
      description,
      category,
      mediaUrl: req.file.path,
      mediaType,
      user: req.user._id,
      boardId,
    });

    const savedPin = await newPin.save();

    // === AUTOMATIC AI TAGGING FOR NEW PINS (IMAGES + VIDEOS) ===
    try {
      console.log("Generating AI tags for new pin...");
      const aiTags = await generateImageTags(savedPin.mediaUrl);
      if (aiTags && aiTags.length > 0) {
        savedPin.tags = aiTags;
        await savedPin.save();
        console.log("AI tags added automatically:", aiTags.join(", "));
      }
    } catch (err) {
      console.log("AI tagging failed (non-critical):", err.message);
      // We don't break the upload even if Gemini is down
    }
    // ===================================================

    if (boardId) {
      await autoAssignCover(boardId, req.file.path);
    }

    res.status(201).json(savedPin);
  } catch (error) {
    console.error("Create pin error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ---------- GET all Pins (public) ----------
router.get("/", async (_req, res) => {
  try {
    const pins = await Pin.find()
      .populate("user", "username email profilePicture")
      .sort({ createdAt: -1 });

    res.status(200).json(pins);
  } catch (error) {
    console.error("Get pins error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ---------- UPDATE a Pin (only owner) ----------
router.put("/:id", protect, async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.id);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    if (String(pin.user) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const updatedPin = await Pin.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    res.status(200).json(updatedPin);
  } catch (error) {
    console.error("Update pin error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ---------- GET single Pin by ID (simple) ----------
router.get("/:id", async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.id).populate(
      "user",
      "username email profilePicture"
    );

    if (!pin) {
      return res.status(404).json({ message: "Pin not found" });
    }

    res.status(200).json(pin);
  } catch (error) {
    console.error("Get pin error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ---------- GET FULL PIN (Pin + likes + commentsCount) ----------
router.get("/:id/full", async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.id)
      .populate("user", "_id username profilePicture")
      .lean();

    if (!pin) {
      return res.status(404).json({ message: "Pin not found" });
    }

    const likes = await Like.find({ pin: pin._id })
      .populate("user", "_id username profilePicture")
      .lean();

    const likesUsers = likes.map((l) => l.user);
    const likesCount = likesUsers.length;

    // commentsCount is kept on Pin document and updated from comment routes
    const commentsCount = pin.commentsCount || 0;

    res.status(200).json({
      ...pin,
      likesUsers,
      likesCount,
      commentsCount,
    });
  } catch (error) {
    console.error("Get full pin error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ---------- DELETE a Pin (only owner) ----------
router.delete("/:id", protect, async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.id);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    if (String(pin.user) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await pin.deleteOne();
    res.status(200).json({ message: "Pin deleted successfully" });
  } catch (error) {
    console.error("Delete pin error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ---------- DOWNLOAD Pin Image / Video ----------
router.get("/:pinId/download", async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    const response = await axios.get(pin.mediaUrl, { responseType: "stream" });
    const contentType = pin.mediaType === "video" ? "video/mp4" : "image/jpeg";
    const filename = `pin-${pin._id}.${
      pin.mediaType === "video" ? "mp4" : "jpg"
    }`;

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    response.data.pipe(res);
  } catch (error) {
    console.error("Download pin error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ---------- LIKE a Pin ----------
router.post("/:pinId/likes", protect, async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    const existing = await Like.findOne({
      user: req.user._id,
      pin: pin._id,
    });
    if (existing) {
      return res.status(400).json({ message: "Already liked" });
    }

    await Like.create({ user: req.user._id, pin: pin._id });

    pin.likesCount += 1;
    await pin.save();

    if (String(pin.user) !== String(req.user._id)) {
      await Notification.create({
        recipient: pin.user,
        sender: req.user._id,
        type: "like",
        pin: pin._id,
        message: `${req.user.username} liked your pin "${pin.title}".`,
      });
    }

    const likes = await Like.find({ pin: pin._id }).populate(
      "user",
      "_id username profilePicture"
    );
    const users = likes.map((like) => like.user);

    res.status(201).json({ likesCount: pin.likesCount, users });
  } catch (error) {
    console.error("Like pin error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ---------- UNLIKE a Pin ----------
router.delete("/:pinId/likes", protect, async (req, res) => {
  try {
    const like = await Like.findOneAndDelete({
      user: req.user._id,
      pin: req.params.pinId,
    });

    if (!like) return res.status(404).json({ message: "Like not found" });

    const pin = await Pin.findById(req.params.pinId);
    if (pin && pin.likesCount > 0) {
      pin.likesCount -= 1;
      await pin.save();
    }

    const likes = await Like.find({ pin: pin._id }).populate(
      "user",
      "_id username profilePicture"
    );
    const users = likes.map((like) => like.user);

    res.status(200).json({ likesCount: pin.likesCount, users });
  } catch (error) {
    console.error("Unlike pin error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ---------- GET Users Who Liked a Pin ----------
router.get("/:pinId/likes", async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    const likes = await Like.find({ pin: pin._id }).populate(
      "user",
      "_id username profilePicture"
    );
    const users = likes.map((like) => like.user);

    res.status(200).json({ likesCount: pin.likesCount, users });
  } catch (error) {
    console.error("Get pin likes error:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;