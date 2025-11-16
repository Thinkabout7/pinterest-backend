// controllers/commentLikeController.js
import CommentLike from "../models/CommentLike.js";
import Comment from "../models/Comment.js";

// 👍 Like a comment (idempotent — cannot double-like)
export const likeComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment)
      return res.status(404).json({ message: "Comment not found" });

    // check if user already liked
    const existing = await CommentLike.findOne({
      user: req.user._id,
      comment: comment._id,
    });

    if (existing) {
      // already liked → return current state
      return res.status(200).json({
        success: true,
        likesCount: comment.likesCount,
        isLiked: true,
      });
    }

    // create like entry
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

// 👍 Unlike a comment
export const unlikeComment = async (req, res) => {
  try {
    const removed = await CommentLike.findOneAndDelete({
      user: req.user._id,
      comment: req.params.commentId,
    });

    const comment = await Comment.findById(req.params.commentId);

    if (removed && comment && comment.likesCount > 0) {
      comment.likesCount -= 1;
      await comment.save();
    }

    return res.status(200).json({
      success: true,
      likesCount: comment?.likesCount || 0,
      isLiked: false,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 👍 List users who reacted
export const getCommentLikes = async (req, res) => {
  try {
    const list = await CommentLike.find({
      comment: req.params.commentId,
    }).populate("user", "_id username profilePicture");

    const users = list.map((like) => like.user);

    res.status(200).json({
      users,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
