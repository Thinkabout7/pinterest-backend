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
    if (!text?.trim()) return res.status(400).json({ message: "Text required" });

    let replyToUsername = null;
    if (parentCommentId) {
      const parent = await Comment.findById(parentCommentId).populate("user", "username");
      if (parent?.user) replyToUsername = parent.user.username;
    }

    const comment = await Comment.create({
      pin: pinId,
      user: req.user._id,
      text: text.trim(),
      parentCommentId: parentCommentId || null,
      replyToUsername,
    });

    await Pin.findByIdAndUpdate(pinId, { $inc: { commentsCount: 1 } });

    const populated = await Comment.findById(comment._id)
      .populate("user", "username profilePicture");

    const safeUser = populated.user || {
      _id: "deleted",
      username: "Deleted User",
      profilePicture: null,
    };

    res.status(201).json({
      _id: populated._id,
      text: populated.text,
      user: safeUser,
      replyToUsername,
      createdAt: populated.createdAt,
      likesCount: 0,
      isLiked: false,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* --------------------------------------------------
   GET COMMENTS FOR PIN — NEVER RETURNS user: null
   -------------------------------------------------- */
export const getCommentsForPin = async (req, res) => {
  try {
    const comments = await Comment.find({ pin: req.params.pinId })
      .populate("user", "username profilePicture")
      .populate("replyToUser", "username")
      .sort({ createdAt: 1 })
      .lean();

    const userId = req.user?._id;
    const map = {};
    const roots = [];

    for (const c of comments) {
      const isLiked = userId ? await CommentLike.exists({ user: userId, comment: c._id }) : false;

      const safeUser = c.user || { _id: "deleted", username: "Deleted User", profilePicture: null };

      const data = {
        _id: c._id,
        text: c.text,
        user: safeUser,
        replyToUsername: c.replyToUser?.username || null,
        likesCount: c.likesCount || 0,
        isLiked: !!isLiked,
        createdAt: c.createdAt,
        replies: [],
      };

      map[c._id] = data;
      if (!c.parentCommentId) roots.push(data);
      else if (map[c.parentCommentId]) map[c.parentCommentId].replies.push(data);
    }

    res.json({ comments: roots, totalCount: comments.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* --------------------------------------------------
   DELETE COMMENT + REPLIES
   -------------------------------------------------- */
export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: "Not found" });

    const toDelete = await Comment.find({
      $or: [{ _id: req.params.id }, { parentCommentId: req.params.id }],
    });

    await Comment.deleteMany({ _id: { $in: toDelete.map(c => c._id) } });
    await Pin.findByIdAndUpdate(comment.pin, { $inc: { commentsCount: -toDelete.length } });

    res.json({ success: true, removed: toDelete.length });
  } catch (err) {
    console.error(err);
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

    const existing = await CommentLike.findOne({ user: req.user._id, comment: comment._id });

    if (existing) {
      await CommentLike.deleteOne({ _id: existing._id });
      comment.likesCount = Math.max(0, (comment.likesCount || 1) - 1);
      await comment.save();
      return res.json({ likesCount: comment.likesCount, isLiked: false });
    }

    await CommentLike.create({ user: req.user._id, comment: comment._id });
    comment.likesCount = (comment.likesCount || 0) + 1;
    await comment.save();

    res.json({ likesCount: comment.likesCount, isLiked: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};