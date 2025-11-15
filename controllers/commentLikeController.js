import CommentLike from "../models/CommentLike.js";
import Comment from "../models/Comment.js";

export const likeComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const existing = await CommentLike.findOne({ user: req.user._id, comment: comment._id });
    if (existing) return res.status(400).json({ message: "Already liked" });

    await CommentLike.create({ user: req.user._id, comment: comment._id });

    comment.likesCount += 1;
    await comment.save();

    res.status(201).json({ message: "Comment liked" });
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

    if (!like) return res.status(404).json({ message: "Like not found" });

    const comment = await Comment.findById(req.params.commentId);
    if (comment.likesCount > 0) {
      comment.likesCount -= 1;
      await comment.save();
    }

    res.status(200).json({ message: "Comment unliked" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCommentLikes = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const likes = await CommentLike.find({ comment: comment._id }).populate("user", "_id username profilePicture");
    const users = likes.map(like => like.user);
    res.status(200).json({ likesCount: comment.likesCount, users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
