// controllers/commentController.js
import Comment from "../models/Comment.js";
import Pin from "../models/Pin.js";
import CommentLike from "../models/CommentLike.js";

/* --------------------------------------------------
   CREATE COMMENT OR REPLY (SAFE + CORRECT)
-------------------------------------------------- */
export const createComment = async (req, res) => {
  try {
    const { pinId, text, parentCommentId } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Text required" });

    let replyToUser = null;

    // If replying, store parent.user ObjectId
    if (parentCommentId) {
      const parent = await Comment.findById(parentCommentId);
      if (parent?.user) replyToUser = parent.user;
    }

    const newComment = await Comment.create({
      pin: pinId,
      user: req.user._id,
      text: text.trim(),
      parentCommentId: parentCommentId || null,
      replyToUser, // important
    });

    // Update comment count
    await Pin.findByIdAndUpdate(pinId, { $inc: { commentsCount: 1 } });

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
   GET COMMENTS FOR PIN (SAFE THREADED VERSION)
-------------------------------------------------- */
export const getCommentsForPin = async (req, res) => {
  try {
    const list = await Comment.find({ pin: req.params.pinId })
      .populate("user", "username profilePicture")
      .populate("replyToUser", "username")
      .sort({ createdAt: 1 })
      .lean();

    const userId = req.user?._id;
    const map = {};

    // FIRST PASS — build map entries
    for (const c of list) {
      const safeUser = c.user || {
        _id: "deleted",
        username: "Deleted User",
        profilePicture: null,
      };

      const isLiked = userId
        ? Boolean(await CommentLike.exists({ user: userId, comment: c._id }))
        : false;

      map[c._id] = {
        _id: c._id,
        text: c.text,
        user: safeUser,
        replyToUsername: c.replyToUser?.username || null,
        likesCount: c.likesCount || 0,
        isLiked,
        createdAt: c.createdAt,
        parentCommentId: c.parentCommentId || null,
        replies: [], // required
      };
    }

    // SECOND PASS — attach replies to parents
    const roots = [];

    for (const id in map) {
      const comment = map[id];
      const parentId = comment.parentCommentId;

      if (parentId && map[parentId]) {
        map[parentId].replies.push(comment);
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
   DELETE COMMENT + REPLIES
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
   TOGGLE LIKE (SAFE)
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
      comment.likesCount = Math.max(0, comment.likesCount - 1);
      await comment.save();
      return res.json({ likesCount: comment.likesCount, isLiked: false });
    }

    await CommentLike.create({
      user: req.user._id,
      comment: comment._id,
    });

    comment.likesCount += 1;
    await comment.save();

    res.json({ likesCount: comment.likesCount, isLiked: true });

  } catch (err) {
    console.error("toggleLike error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
