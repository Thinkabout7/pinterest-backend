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
    console.error("Create pin error:", error);
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
    console.error("Get pin error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ---------- GET FULL PIN (Pin + likes + comments count) ----------
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

    // commentsCount is stored on the Pin document
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

// ---------- DOWNLOAD Pin Image ----------
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

// ---------- GET ALL COMMENTS FOR A PIN ----------
router.get("/:pinId/comments", async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    // Get all comments for the pin
    const allComments = await Comment.find({ pinId: pin._id })
      .populate("userId", "username profilePicture")
      .sort({ createdAt: 1 })
      .lean();

    // Build tree
    const commentMap = new Map();
    const mainComments = [];

    allComments.forEach((comment) => {
      const commentObj = {
        _id: comment._id,
        text: comment.text,
        user: comment.userId,
        likesCount: comment.likes.length,
        createdAt: comment.createdAt,
        parentComment: comment.parentCommentId,
        replies: [],
      };

      commentMap.set(comment._id.toString(), commentObj);

      if (!comment.parentCommentId) {
        mainComments.push(commentObj);
      }
    });

    // Attach replies
    allComments.forEach((comment) => {
      if (comment.parentCommentId) {
        const parent = commentMap.get(comment.parentCommentId.toString());
        if (parent) {
          const replyObj = commentMap.get(comment._id.toString());
          replyObj.replyToUsername = parent.user.username;
          parent.replies.push(replyObj);
        }
      }
    });

    // Sort main comments by newest first
    mainComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Sort replies by oldest first
    mainComments.forEach((main) => {
      main.replies.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    });

    res.status(200).json(mainComments);
  } catch (error) {
    console.error("Get comments error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ---------- CREATE A NEW MAIN COMMENT ----------
router.post("/:pinId/comments", protect, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ message: "Text is required" });
    }

    const pin = await Pin.findById(req.params.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    const comment = await Comment.create({
      pinId: pin._id,
      userId: req.user._id,
      text,
      parentCommentId: null,
    });

    // Update comment count
    pin.commentsCount += 1;
    await pin.save();

    const populatedComment = await Comment.findById(comment._id).populate(
      "userId",
      "username profilePicture"
    );

    res.status(201).json(populatedComment);
  } catch (error) {
    console.error("Create comment error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ---------- CREATE A REPLY TO AN EXISTING COMMENT ----------
router.post("/:pinId/comments/:commentId/reply", protect, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ message: "Text is required" });
    }

    const pin = await Pin.findById(req.params.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    const parentComment = await Comment.findById(req.params.commentId);
    if (!parentComment) return res.status(404).json({ message: "Parent comment not found" });

    const reply = await Comment.create({
      pinId: pin._id,
      userId: req.user._id,
      text,
      parentCommentId: parentComment._id,
    });

    // Update comment count
    pin.commentsCount += 1;
    await pin.save();

    const populatedReply = await Comment.findById(reply._id).populate(
      "userId",
      "username profilePicture"
    );

    res.status(201).json(populatedReply);
  } catch (error) {
    console.error("Create reply error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ---------- LIKE A COMMENT ----------
router.post("/comments/:commentId/likes", protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const userIdStr = req.user._id.toString();
    const likes = comment.likes.map((id) => id.toString());

    if (likes.includes(userIdStr)) {
      return res.status(400).json({ message: "Already liked" });
    }

    comment.likes.push(req.user._id);
    await comment.save();

    res.status(201).json({ likesCount: comment.likes.length });
  } catch (error) {
    console.error("Like comment error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ---------- UNLIKE A COMMENT ----------
router.delete("/comments/:commentId/likes", protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const userIdStr = req.user._id.toString();
    const likes = comment.likes.map((id) => id.toString());

    if (!likes.includes(userIdStr)) {
      return res.status(400).json({ message: "Not liked yet" });
    }

    comment.likes = comment.likes.filter((id) => id.toString() !== userIdStr);
    await comment.save();

    res.status(200).json({ likesCount: comment.likes.length });
  } catch (error) {
    console.error("Unlike comment error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ---------- GET USERS WHO LIKED A COMMENT ----------
router.get("/comments/:commentId/likes", async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const users = await CommentLike.find({ comment: comment._id }).populate(
      "user",
      "_id username profilePicture"
    ).lean();

    const userList = users.map((like) => like.user);

    res.status(200).json({ likesCount: comment.likes.length, users: userList });
  } catch (error) {
    console.error("Get comment likes error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ---------- DELETE A COMMENT OR REPLY ----------
router.delete("/comments/:commentId", protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const pin = await Pin.findById(comment.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    // Only comment owner or pin owner
    if (
      comment.userId.toString() !== req.user._id.toString() &&
      pin.user.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Collect all descendants
    const idsToDelete = [comment._id];
    let idx = 0;

    while (idx < idsToDelete.length) {
      const children = await Comment.find(
        { parentCommentId: idsToDelete[idx] },
        "_id"
      );
      children.forEach((ch) => idsToDelete.push(ch._id));
      idx++;
    }

    // Delete all
    await Comment.deleteMany({ _id: { $in: idsToDelete } });

    // Update comment count
    const totalCount = await Comment.countDocuments({ pinId: comment.pinId });
    await Pin.findByIdAndUpdate(comment.pinId, { commentsCount: totalCount });

    res.status(200).json({ message: "Comment deleted" });
  } catch (error) {
    console.error("Delete comment error:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
