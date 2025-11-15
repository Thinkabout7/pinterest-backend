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
import {
  likeComment,
  unlikeComment,
  getCommentLikes,
} from "../controllers/commentLikeController.js";

const router = express.Router();

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
      .populate("user", "username email profilePicture")
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
    const pin = await Pin.findById(req.params.id).populate(
      "user",
      "username email profilePicture"
    );

    if (!pin) {
      return res.status(404).json({ message: "Pin not found" });
    }

    res.status(200).json(pin);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------- GET FULL PIN (Pin + Likes + Comments flat) ----------
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

    const comments = await Comment.find({ pin: pin._id })
      .populate("user", "_id username profilePicture")
      .sort({ createdAt: 1 })
      .lean();

    const commentsCount = pin.commentsCount;

    res.status(200).json({
      ...pin,
      likesUsers,
      likesCount,
      comments,
      commentsCount,
    });
  } catch (error) {
    console.error(error);
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

    const response = await axios.get(pin.mediaUrl, { responseType: "stream" });
    const contentType =
      pin.mediaType === "video" ? "video/mp4" : "image/jpeg";
    const filename = `pin-${pin._id}.${
      pin.mediaType === "video" ? "mp4" : "jpg"
    }`;

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    response.data.pipe(res);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------- LIKE a Pin ----------
router.post("/:pinId/likes", protect, async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    const existing = await Like.findOne({ user: req.user._id, pin: pin._id });
    if (existing) return res.status(400).json({ message: "Already liked" });

    await Like.create({ user: req.user._id, pin: pin._id });

    pin.likesCount += 1;
    await pin.save();

    if (pin.user.toString() !== req.user._id.toString()) {
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
    if (pin.likesCount > 0) {
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
    res.status(500).json({ message: error.message });
  }
});

//
// ====== COMMENTS (PINS) ======
//

// ---------- CREATE a Comment or Reply ----------
router.post("/:pinId/comments", protect, async (req, res) => {
  try {
    const { text, parentCommentId } = req.body;
    if (!text) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const pin = await Pin.findById(req.params.pinId);
    if (!pin) {
      return res.status(404).json({ message: "Pin not found" });
    }

    const commentData = {
      text,
      user: req.user._id,
      pin: pin._id,
    };

    if (parentCommentId) {
      const parent = await Comment.findById(parentCommentId);
      if (!parent) {
        return res.status(400).json({ message: "Parent comment not found" });
      }
      // link reply to parent
      commentData.parentComment = parent._id;
    }

    const comment = await Comment.create(commentData);

    // Only count top-level comments in pin.commentsCount
    if (!parentCommentId) {
      pin.commentsCount += 1;
      await pin.save();
    }

    const populatedComment = await Comment.findById(comment._id).populate(
      "user",
      "_id username profilePicture"
    );

    res.status(201).json(populatedComment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// ---------- GET Comments for a Pin (top-level + nested replies) ----------
router.get("/:pinId/comments", async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    const allComments = await Comment.find({ pin: pin._id })
      .populate("user", "_id username profilePicture")
      .sort({ createdAt: 1 })
      .lean();

    // Build map and replies
    const commentMap = new Map();
    const topLevel = [];

    // Initialize replies array on each comment
    for (const c of allComments) {
      c.replies = [];
      commentMap.set(c._id.toString(), c);
    }

    for (const c of allComments) {
      if (c.parentComment) {
        const parent = commentMap.get(c.parentComment.toString());
        if (parent) {
          parent.replies.push(c);
        }
      } else {
        topLevel.push(c);
      }
    }

    res.status(200).json(topLevel);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------- DELETE a Comment (top-level or reply) ----------
router.delete("/comments/:commentId", protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const pin = await Pin.findById(comment.pin);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    // Only comment owner or pin owner can delete
    if (
      comment.user.toString() !== req.user._id.toString() &&
      pin.user.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this comment" });
    }

    // If top-level comment: delete its replies + all likes
    if (!comment.parentComment) {
      const replies = await Comment.find({ parentComment: comment._id });
      const replyIds = replies.map((r) => r._id);

      // delete likes for main + replies
      await CommentLike.deleteMany({
        comment: { $in: [comment._id, ...replyIds] },
      });

      // delete comments (main + replies)
      await Comment.deleteMany({
        $or: [{ _id: comment._id }, { parentComment: comment._id }],
      });

      // decrease comment count (only top-level counted)
      if (pin.commentsCount > 0) {
        pin.commentsCount -= 1;
        await pin.save();
      }
    } else {
      // It's a reply: delete only this comment + its likes
      await CommentLike.deleteMany({ comment: comment._id });
      await Comment.findByIdAndDelete(comment._id);
    }

    res.status(200).json({ message: "Comment deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ---------- LIKE a Comment ----------
router.post("/comments/:commentId/likes", protect, likeComment);

// ---------- UNLIKE a Comment ----------
router.delete("/comments/:commentId/likes", protect, unlikeComment);

// ---------- GET Comment Reactions (who liked this comment) ----------
router.get("/comments/:commentId/likes", getCommentLikes);

export default router;
