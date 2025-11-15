import Comment from "../models/Comment.js";
import Pin from "../models/Pin.js";

export const createComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: "Comment text is required" });

    const pin = await Pin.findById(req.params.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    const comment = await Comment.create({
      text,
      user: req.user._id,
      pin: pin._id,
    });

    pin.commentsCount += 1;
    await pin.save();

    const populatedComment = await Comment.findById(comment._id).populate("user", "username profilePicture");
    res.status(201).json(populatedComment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createReply = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: "Reply text is required" });

    const parentComment = await Comment.findById(req.params.commentId);
    if (!parentComment) return res.status(404).json({ message: "Parent comment not found" });

    const reply = await Comment.create({
      text,
      user: req.user._id,
      pin: parentComment.pin,
      parentComment: parentComment._id,
    });

    parentComment.replies.push(reply._id);
    await parentComment.save();

    const populatedReply = await Comment.findById(reply._id).populate("user", "username profilePicture");
    res.status(201).json(populatedReply);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCommentsForPin = async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    const comments = await Comment.find({ pin: pin._id, parentComment: null })
      .populate("user", "username profilePicture")
      .populate({
        path: "replies",
        populate: { path: "user", select: "username profilePicture" },
      })
      .sort({ createdAt: 1 });

    res.status(200).json(comments);
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

    if (comment.user.toString() !== req.user._id.toString() && pin.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this comment" });
    }

    if (comment.parentComment) {
      // Remove from parent's replies
      await Comment.findByIdAndUpdate(comment.parentComment, { $pull: { replies: comment._id } });
    } else {
      // Top-level comment, decrement pin.commentsCount
      if (pin.commentsCount > 0) {
        pin.commentsCount -= 1;
        await pin.save();
      }
    }

    // Delete the comment and its replies
    await Comment.deleteMany({ $or: [{ _id: comment._id }, { parentComment: comment._id }] });

    res.status(200).json({ message: "Comment deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
