import Comment from "../models/Comment.js";
import Pin from "../models/Pin.js";

export const createComment = async (req, res) => {
  try {
    const { text, parentCommentId } = req.body;
    if (!text) return res.status(400).json({ message: "Comment text is required" });

    const pin = await Pin.findById(req.params.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    const commentData = {
      text,
      user: req.user._id,
      pin: pin._id,
      parentCommentId: parentCommentId || null,
    };

    const comment = await Comment.create(commentData);

    // Increase pin.commentsCount only for top-level comments
    if (!parentCommentId) {
      pin.commentsCount += 1;
      await pin.save();
    }

    const populatedComment = await Comment.findById(comment._id).populate("user", "username profilePicture");
    res.status(201).json(populatedComment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCommentsForPin = async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    // Get top-level comments
    const topLevelComments = await Comment.find({ pin: pin._id, parentCommentId: null })
      .populate("user", "username profilePicture")
      .sort({ createdAt: 1 });

    // For each top-level comment, get its replies
    const commentsWithReplies = await Promise.all(
      topLevelComments.map(async (comment) => {
        const replies = await Comment.find({ parentCommentId: comment._id })
          .populate("user", "username profilePicture")
          .sort({ createdAt: 1 });
        return {
          ...comment.toObject(),
          replies,
        };
      })
    );

    res.status(200).json(commentsWithReplies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const pin = await Pin.findById(comment.pin);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    // Check authorization: comment owner or pin owner
    if (comment.user.toString() !== req.user._id.toString() && pin.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this comment" });
    }

    // If top-level comment, delete replies too
    if (!comment.parentCommentId) {
      await Comment.deleteMany({ parentCommentId: comment._id });
      // Decrease pin.commentsCount
      if (pin.commentsCount > 0) {
        pin.commentsCount -= 1;
        await pin.save();
      }
    }

    await Comment.findByIdAndDelete(req.params.commentId);

    res.status(200).json({ message: "Comment deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const likeComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    if (comment.likes.includes(req.user._id)) {
      return res.status(400).json({ message: "Already liked" });
    }

    comment.likes.push(req.user._id);
    comment.likeCount = comment.likes.length;
    await comment.save();

    res.status(200).json(comment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const unlikeComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const likeIndex = comment.likes.indexOf(req.user._id);
    if (likeIndex === -1) {
      return res.status(404).json({ message: "Like not found" });
    }

    comment.likes.splice(likeIndex, 1);
    comment.likeCount = comment.likes.length;
    await comment.save();

    res.status(200).json(comment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
