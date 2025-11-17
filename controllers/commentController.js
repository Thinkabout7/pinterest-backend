import Comment from "../models/Comment.js";
import CommentLike from "../models/CommentLike.js";

// -------------------- CREATE COMMENT OR REPLY --------------------
//COMMENTCONTROLLER.JS
export const createComment = async (req, res) => {
  try {
    const { pinId, text, parentCommentId } = req.body;

    if (!text || !text.trim())
      return res.status(400).json({ message: "Text required" });

    // find parent to get replied user
    let repliedUser = null;
    if (parentCommentId) {
      const parent = await Comment.findById(parentCommentId);
      if (parent) repliedUser = parent.user;
    }

    const newComment = await Comment.create({
      pin: pinId,
      user: req.user._id,
      text,
      parentCommentId: parentCommentId || null,
      replyToUser: repliedUser,
    });

    const populated = await Comment.findById(newComment._id)
      .populate("user", "username profilePicture")
      .populate("replyToUser", "username");

    res.status(201).json({
      _id: populated._id,
      text: populated.text,
      user: populated.user,
      replyToUsername: populated.replyToUser
        ? populated.replyToUser.username
        : null,
      createdAt: populated.createdAt,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// -------------------- GET COMMENTS (THREADED) --------------------
//COMMENTCONTROLLER.JS
export const getCommentsForPin = async (req, res) => {
  try {
    const list = await Comment.find({ pin: req.params.pinId })
      .populate("user", "username profilePicture")
      .populate("replyToUser", "username")
      .sort({ createdAt: 1 })
      .lean();

    const map = {};
    const main = [];

    // 1. Build comment map
    list.forEach((c) => {
      map[c._id] = {
        _id: c._id,
        text: c.text,
        user: c.user,
        likesCount: c.likesCount || 0,
        isLiked: false,
        createdAt: c.createdAt,
        replyToUsername: c.replyToUser ? c.replyToUser.username : null,
        replies: [],
        parentCommentId: c.parentCommentId || null,
      };
    });

    // 2. Link replies
    list.forEach((c) => {
      if (c.parentCommentId) {
        const parent = map[c.parentCommentId];
        if (parent) parent.replies.push(map[c._id]);
      } else {
        main.push(map[c._id]);
      }
    });

    res.status(200).json({ comments: main, totalCount: list.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// -------------------- DELETE COMMENT --------------------
export const deleteComment = async (req, res) => {
  try {
    await Comment.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// -------------------- TOGGLE LIKE --------------------
export const toggleLike = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment)
      return res.status(404).json({ message: "Comment not found" });

    const existing = await CommentLike.findOne({
      user: req.user._id,
      comment: comment._id,
    });

    if (existing) {
      // unlike
      await CommentLike.findByIdAndDelete(existing._id);
      comment.likesCount = Math.max(0, comment.likesCount - 1);
      await comment.save();
      return res.json({ likesCount: comment.likesCount, isLiked: false });
    }

    // like
    await CommentLike.create({ user: req.user._id, comment: comment._id });
    comment.likesCount += 1;
    await comment.save();

    res.json({ likesCount: comment.likesCount, isLiked: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
