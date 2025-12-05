// controllers/commentLikeController.js
import CommentLike from "../models/CommentLike.js";
import Comment from "../models/Comment.js";

export const likeComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const existing = await CommentLike.findOne({
      user: req.user._id,
      comment: comment._id,
    });

    if (existing) {
      // already liked → just return current state (idempotent)
      return res.status(200).json({
        success: true,
        likesCount: comment.likesCount,
      });
    }

    await CommentLike.create({ user: req.user._id, comment: comment._id });

    comment.likesCount += 1;
    await comment.save();

    res.status(201).json({
      success: true,
      likesCount: comment.likesCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const unlikeComment = async (req, res) => {
  try {
    const like = await CommentLike.findOneAndDelete({
      user: req.user._id,
      comment: req.params.commentId,
    });

    if (!like) {
      // nothing to unlike → ok but no change
      return res.status(200).json({ message: "Not liked yet" });
    }

    const comment = await Comment.findById(req.params.commentId);
    if (comment && comment.likesCount > 0) {
      comment.likesCount -= 1;
      await comment.save();
    }

    res.status(200).json({
      success: true,
      likesCount: comment ? comment.likesCount : 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCommentLikes = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const likes = await CommentLike.find({ comment: comment._id }).populate(
      "user",
      "_id username profilePicture"
    );

    const users = likes.map((like) => like.user);

    res.status(200).json({
      likesCount: comment.likesCount,
      users,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
