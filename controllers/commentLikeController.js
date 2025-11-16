// controllers/commentLikeController.js
import CommentLike from "../models/CommentLike.js";
import Comment from "../models/Comment.js";

// LIKE (idempotent)
export const likeComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment)
      return res.status(404).json({ message: "Comment not found" });

    if (comment.likesCount == null) comment.likesCount = 0;

    const existing = await CommentLike.findOne({
      user: req.user._id,
      comment: comment._id,
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        likesCount: comment.likesCount,
        isLiked: true,
      });
    }

    await CommentLike.create({
      user: req.user._id,
      comment: comment._id,
    });

    comment.likesCount += 1;
    await comment.save();

    res.status(201).json({
      success: true,
      likesCount: comment.likesCount,
      isLiked: true,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UNLIKE
export const unlikeComment = async (req, res) => {
  try {
    const removed = await CommentLike.findOneAndDelete({
      user: req.user._id,
      comment: req.params.commentId,
    });

    const comment = await Comment.findById(req.params.commentId);
    if (!comment)
      return res.status(404).json({ message: "Comment not found" });

    if (comment.likesCount == null) comment.likesCount = 0;

    if (removed) {
      comment.likesCount = Math.max(0, comment.likesCount - 1);
      await comment.save();
    }

    res.status(200).json({
      success: true,
      likesCount: comment.likesCount,
      isLiked: false,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET list of users who reacted
export const getCommentLikes = async (req, res) => {
  try {
    const list = await CommentLike.find({
      comment: req.params.commentId,
    }).populate("user", "_id username profilePicture");

    const users = list.map((l) => l.user);

    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
