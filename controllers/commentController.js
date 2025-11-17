// controllers/commentController.js

import Comment from "../models/Comment.js";
import Pin from "../models/Pin.js";
import CommentLike from "../models/CommentLike.js";

/* --------------------------------------------------
   CREATE COMMENT OR REPLY
   FIXED:
   ✔ Increment Pin.commentsCount by +1 for every comment or reply
   -------------------------------------------------- */
export const createComment = async (req, res) => {
  try {
    const { pinId, text, parentCommentId } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Text required" });
    }

    // find user being replied to (if reply)
    let repliedUser = null;
    if (parentCommentId) {
      const parent = await Comment.findById(parentCommentId);
      if (parent) repliedUser = parent.user;
    }

    // create comment or reply
    const newComment = await Comment.create({
      pin: pinId,
      user: req.user._id,
      text,
      parentCommentId: parentCommentId || null,
      replyToUser: repliedUser,
    });

    /* FIXED — increment Pin comment count */
    await Pin.findByIdAndUpdate(pinId, {
      $inc: { commentsCount: 1 }
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

/* --------------------------------------------------
   GET COMMENTS FOR PIN (THREADED)
   FIXED:
   ✔ totalCount includes replies
   ✔ returns correct full list (no changes needed)
   -------------------------------------------------- */
export const getCommentsForPin = async (req, res) => {
  try {
    const list = await Comment.find({ pin: req.params.pinId })
      .populate("user", "username profilePicture")
      .populate("replyToUser", "username")
      .sort({ createdAt: 1 })
      .lean();

    const totalCount = list.length; // already correct — includes replies

    const map = {};
    const main = [];

    for (const c of list) {
      const isLiked = await CommentLike.exists({
        user: req.user?._id,
        comment: c._id,
      });

      map[c._id] = {
        _id: c._id,
        text: c.text,
        user: c.user,
        likesCount: c.likesCount || 0,
        isLiked: !!isLiked,
        createdAt: c.createdAt,
        replyToUsername: c.replyToUser ? c.replyToUser.username : null,
        replies: [],
        parentCommentId: c.parentCommentId || null,
      };
    }

    // build threaded tree
    list.forEach((c) => {
      if (c.parentCommentId) {
        const parent = map[c.parentCommentId];
        if (parent) parent.replies.push(map[c._id]);
      } else {
        main.push(map[c._id]);
      }
    });

    res.status(200).json({
      comments: main,
      totalCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* --------------------------------------------------
   DELETE COMMENT
   FIXED:
   ✔ Deletes parent AND all its replies
   ✔ Correctly subtracts (1 + number of replies) from Pin.commentsCount
   -------------------------------------------------- */
export const deleteComment = async (req, res) => {
  try {
    const commentId = req.params.id;

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const pinId = comment.pin;

    // find all replies belonging to this comment
    const allToDelete = await Comment.find({
      $or: [
        { _id: commentId },
        { parentCommentId: commentId },
      ],
    });

    const countToRemove = allToDelete.length;

    // delete all comments + replies
    await Comment.deleteMany({
      _id: { $in: allToDelete.map((c) => c._id) },
    });
    /* FIXED — decrement comment count correctly */
    await Pin.findByIdAndUpdate(pinId, {
      $inc: { commentsCount: -countToRemove }
    });

    res.json({ success: true, removed: countToRemove });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* --------------------------------------------------
   TOGGLE LIKE COMMENT
   FIXED:
   ✔ Does NOT affect comment count (correct behavior)
   -------------------------------------------------- */
export const toggleLike = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment)
      return res.status(404).json({ message: "Comment not found" });

    const existing = await CommentLike.findOne({
      user: req.user._id,
      comment: comment._id,
    });

    // unlike
    if (existing) {
      await CommentLike.findByIdAndDelete(existing._id);
      comment.likesCount = Math.max(0, comment.likesCount - 1);
      await comment.save();

      return res.json({
        likesCount: comment.likesCount,
        isLiked: false,
      });
    }

    // like
    await CommentLike.create({
      user: req.user._id,
      comment: comment._id,
    });

    comment.likesCount += 1;
    await comment.save();

    res.json({
      likesCount: comment.likesCount,
      isLiked: true,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};