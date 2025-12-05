// controllers/commentController.js
import Comment from "../models/Comment.js";
import Pin from "../models/Pin.js";
import CommentLike from "../models/CommentLike.js";
import Notification from "../models/Notification.js";   // 🔔 NOTIF IMPORT

/* --------------------------------------------------
   CREATE COMMENT OR REPLY (SAFE + CORRECT)
-------------------------------------------------- */
export const createComment = async (req, res) => {
  try {
    const { pinId, text, parentCommentId } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ message: "Text required" });
    }

    let replyToUser = null;

    // If replying, store parent.user ObjectId
    let parent = null;
    if (parentCommentId) {
      parent = await Comment.findById(parentCommentId);
      if (parent?.user) replyToUser = parent.user;
    }

    const newComment = await Comment.create({
      pin: pinId,
      user: req.user._id,
      text: text.trim(),
      parentCommentId: parentCommentId || null,
      replyToUser,
    });

    // Update comment count on Pin
    const pin = await Pin.findByIdAndUpdate(
      pinId,
      { $inc: { commentsCount: 1 } },
      { new: true }
    );

    /* --------------------------------------------------
       🔔 NOTIFICATIONS
    -------------------------------------------------- */

    // 1️⃣ Commented on someone's pin
    if (pin && String(pin.user) !== String(req.user._id) && !parentCommentId) {
      await Notification.create({
        recipient: pin.user,
        sender: req.user._id,
        type: "comment",
        pin: pin._id,
        message: `${req.user.username} commented on your pin.`,
      });
    }

    // 2️⃣ Replied to someone's comment
    if (parent && String(parent.user) !== String(req.user._id)) {
      await Notification.create({
        recipient: parent.user,
        sender: req.user._id,
        type: "comment",
        pin: pin._id,
        message: `${req.user.username} replied to your comment.`,
      });
    }

    const populated = await Comment.findById(newComment._id)
      .populate("user", "username profilePicture")
      .populate("replyToUser", "username");

    const safeUser = populated.user || {
      _id: "deleted",
      username: "Deleted User",
      profilePicture: null,
    };

    res.status(201).json({
      _id: populated._id,
      text: populated.text,
      user: safeUser,
      replyToUsername: populated.replyToUser?.username || null,
      createdAt: populated.createdAt,
      likesCount: 0,
      isLiked: false,
    });
  } catch (err) {
    console.error("createComment error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* --------------------------------------------------
   GET COMMENTS FOR PIN (THREADED + SAFE)
-------------------------------------------------- */
export const getCommentsForPin = async (req, res) => {
  try {
    const list = await Comment.find({ pin: req.params.pinId })
      .populate("user", "username profilePicture")
      .populate("replyToUser", "username")
      .sort({ createdAt: 1 })
      .lean();

    const userId = req.user?._id || null;
    const map = {};

    // FIRST PASS — build map
    for (const c of list) {
      const key = String(c._id);
      const parentKey = c.parentCommentId ? String(c.parentCommentId) : null;

      const safeUser = c.user || {
        _id: "deleted",
        username: "Deleted User",
        profilePicture: null,
      };

      const isLiked = userId
        ? Boolean(await CommentLike.exists({ user: userId, comment: c._id }))
        : false;

      map[key] = {
        _id: key,
        text: c.text,
        user: safeUser,
        replyToUsername: c.replyToUser?.username || null,
        likesCount: c.likesCount || 0,
        isLiked,
        createdAt: c.createdAt,
        parentCommentId: parentKey,
        replies: [],
      };
    }

    // SECOND PASS — attach replies
    const roots = [];

    for (const key in map) {
      const comment = map[key];
      const parentKey = comment.parentCommentId;

      if (parentKey && map[parentKey]) {
        map[parentKey].replies.push(comment);
      } else {
        roots.push(comment);
      }
    }

    res.json({
      comments: roots,
      totalCount: list.length,
    });
  } catch (err) {
    console.error("getCommentsForPin error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* --------------------------------------------------
   DELETE COMMENT + DIRECT REPLIES
-------------------------------------------------- */
export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: "Not found" });

    const children = await Comment.find({
      $or: [{ _id: req.params.id }, { parentCommentId: req.params.id }],
    });

    await Comment.deleteMany({ _id: { $in: children.map((c) => c._id) } });

    await Pin.findByIdAndUpdate(comment.pin, {
      $inc: { commentsCount: -children.length },
    });

    res.json({ success: true, removed: children.length });
  } catch (err) {
    console.error("deleteComment error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* --------------------------------------------------
   TOGGLE LIKE (WITH NOTIFICATION)
-------------------------------------------------- */
export const toggleLike = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Not found" });

    const existing = await CommentLike.findOne({
      user: req.user._id,
      comment: comment._id,
    });

    // UNLIKE
    if (existing) {
      await CommentLike.deleteOne({ _id: existing._id });
      comment.likesCount = Math.max(0, comment.likesCount - 1);
      await comment.save();
      return res.json({ likesCount: comment.likesCount, isLiked: false });
    }

    // LIKE
    await CommentLike.create({
      user: req.user._id,
      comment: comment._id,
    });

    comment.likesCount += 1;
    await comment.save();

    /* --------------------------------------------------
       🔔 NOTIFY COMMENT OWNER (if not self)
    -------------------------------------------------- */
    if (String(comment.user) !== String(req.user._id)) {
      await Notification.create({
        recipient: comment.user,
        sender: req.user._id,
        type: "comment",
        pin: comment.pin,
        message: `${req.user.username} liked your comment.`,
      });
    }

    res.json({ likesCount: comment.likesCount, isLiked: true });
  } catch (err) {
    console.error("toggleLike error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* --------------------------------------------------
   GET USERS WHO LIKED A COMMENT (FOR REACTION MODAL)
-------------------------------------------------- */
export const getCommentLikes = async (req, res) => {
  try {
    const list = await CommentLike.find({
      comment: req.params.commentId,
    }).populate("user", "_id username profilePicture");

    const users = list
      .map((l) => l.user)
      .filter(Boolean);

    res.json({ users });
  } catch (err) {
    console.error("getCommentLikes error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
