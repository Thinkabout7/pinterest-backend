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

// AI TAGGING
import { generateImageTags } from "../helpers/geminiImageTags.js";

// THE IMPORTANT PART — import the updated controller version
import {
  getAllPins,
  getPinById,
  getFullPin
} from "../controllers/pinController.js";

const router = express.Router();

/* ---------------------------------------------------------
   CREATE NEW PIN (Image / Video)
---------------------------------------------------------- */
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

    // AI TAGGING
    try {
      const aiTags = await generateImageTags(savedPin.mediaUrl);
      if (aiTags?.length > 0) {
        savedPin.tags = aiTags;
        await savedPin.save();
      }
    } catch (err) {
      console.log("AI tagging failed:", err.message);
    }

    if (boardId) {
      await autoAssignCover(boardId, req.file.path);
    }

    res.status(201).json(savedPin);
  } catch (error) {
    console.error("Create pin error:", error);
    res.status(500).json({ message: error.message });
  }
});

/* ---------------------------------------------------------
   GET ALL PINS — NOW USING CONTROLLER WITH HIDE LOGIC
---------------------------------------------------------- */
router.get("/", getAllPins);

/* ---------------------------------------------------------
   GET SINGLE PIN (basic)
---------------------------------------------------------- */
router.get("/:id", getPinById);

/* ---------------------------------------------------------
   GET FULL PIN (likes + commentsCount)
---------------------------------------------------------- */
router.get("/:id/full", getFullPin);

/* ---------------------------------------------------------
   UPDATE PIN (only owner)
---------------------------------------------------------- */
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

/* ---------------------------------------------------------
   DELETE PIN
---------------------------------------------------------- */
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

/* ---------------------------------------------------------
   DOWNLOAD PIN MEDIA
---------------------------------------------------------- */
router.get("/:pinId/download", async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    const response = await axios.get(pin.mediaUrl, { responseType: "stream" });
    const contentType = pin.mediaType === "video" ? "video/mp4" : "image/jpeg";
    const filename = `pin-${pin._id}.${pin.mediaType === "video" ? "mp4" : "jpg"}`;

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    response.data.pipe(res);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ message: error.message });
  }
});

/* ---------------------------------------------------------
   LIKE PIN
---------------------------------------------------------- */
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
        message: `${req.user.username} liked your pin`,
      });
    }

    const likes = await Like.find({ pin: pin._id }).populate(
      "user",
      "_id username profilePicture"
    );
    const users = likes.map((like) => like.user);

    res.status(201).json({ likesCount: pin.likesCount, users });
  } catch (error) {
    console.error("Like error:", error);
    res.status(500).json({ message: error.message });
  }
});

/* ---------------------------------------------------------
   UNLIKE PIN
---------------------------------------------------------- */
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
    console.error("Unlike error:", error);
    res.status(500).json({ message: error.message });
  }
});

/* ---------------------------------------------------------
   GET USERS WHO LIKED A PIN
---------------------------------------------------------- */
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
    console.error("Get likes error:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
