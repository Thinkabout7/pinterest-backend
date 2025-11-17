// controllers/commentController.js
import Comment from "../models/Comment.js";
import Pin from "../models/Pin.js";
import CommentLike from "../models/CommentLike.js";

/* --------------------------------------------------
   CREATE COMMENT OR REPLY
   -------------------------------------------------- */
export const createComment = async (req, res) => {
  try {
    const { pinId, text, parentCommentId } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Text required" });
    }

    let replyToUsername = null;
    if (parentCommentId) {
      const parent = await Comment.findById(parentCommentId).populate("user", "username");
      if (parent && parent.user) {
        replyToUsername = parent.user.username;
      }
    }

    const newComment = await Comment.create({
      pin: pinId,
      user: req.user._id,
      text: text.trim(),
      parentCommentId: parentCommentId || null,
      replyToUsername,
    });

    await Pin.findByIdAndUpdate(pinId, { $inc: { commentsCount: 1 } });

    const populated = await Comment.findById(newComment._id)
      .populate("user", "username profilePicture");

    // SAFETY: never send user: null
    const safeUser = populated.user || {
      _id: "deleted",
      username: "Deleted User",
      profilePicture: null,
    };

    res.status(201).json({
      _id: populated._id,
      text: populated.text,
      user: safeUser,
      replyToUsername: replyToUsername,
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
   GET COMMENTS FOR PIN (THREADED) — FIXED user: null
   -------------------------------------------------- */
export const getCommentsForPin = async (req, res) => {
  try {
    const comments = await Comment.find({ pin: req.params.pinId })
      .populate("user", "username profilePicture")
      .populate({
        path: "replyToUser",
        select: "username",
      })
      .sort({ createdAt: 1 })
      .lean();

    const userId = req.user?._id;

    // Build map with safe users
    const commentMap = {};
    const rootComments = [];

    for (const c of comments) {
      const isLiked = userId
        ? await CommentLike.exists({ user: userId, comment: c._id })
        : false;

      // NEVER let user be null
      const safeUser = c.user || {
        _id: "deleted",
        username: "Deleted User",
        profilePicture: null,
      };

      const commentData = {
        _id: c._id,
        text: c.text,
        user: safeUser,
        replyToUsername: c.replyToUser?.username || null,
        likesCount: c.likesCount || 0,
        isLiked: !!isLiked,
        createdAt: c.createdAt,
        replies: [],
      };

      commentMap[c._id] = commentData;

      if (!c.parentCommentId) {
        rootComments.push(commentData);
      } else if (commentMap[c.parentCommentId]) {
        commentMap[c.parentCommentId].replies.push(commentData);
      }
    }

    res.json({
      comments: rootComments,
      totalCount: comments.length,
    });
  } catch (err) {
    console.error("getCommentsForPin error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* --------------------------------------------------
   DELETE COMMENT + ALL REPLIES
   -------------------------------------------------- */
export const deleteComment = async (req, res) => {
  try {
    const commentId = req.params.id;
    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Not found" });

    const allToDelete = await Comment.find({
      $or: [{ _id: commentId }, { parentCommentId: commentId }],
    });

    const count = allToDelete.length;

    await Comment.deleteMany({
      _id: { $in: allToDelete.map((c) => c._id) },
    });

    await Pin.findByIdAndUpdate(comment.pin, {
      $inc: { commentsCount: -count },
    });

    res.json({ success: true, removed: count });
  } catch (err) {
    console.error("deleteComment error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* --------------------------------------------------
   TOGGLE LIKE
   -------------------------------------------------- */
export const toggleLike = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Not found" });

    const existing = await CommentLike.findOne({
      user: req.user._id,
      comment: comment._id,
    });

    if (existing) {
      await CommentLike.deleteOne({ _id: existing._id });
      comment.likesCount = Math.max(0, (comment.likesCount || 1) - 1);
      await comment.save();
      return res.json({ likesCount: comment.likesCount, isLiked: false });
    }

    await CommentLike.create({
      user: req.user._id,
      comment: comment._id,
    });
    comment.likesCount = (comment.likesCount || 0) + 1;
    await comment.save();

    res.json({ likesCount: comment.likesCount, isLiked: true });
  } catch (err) {
    console.error("toggleLike error:", err);
    res.status(500).json({ message: "Server error" });
  }
};