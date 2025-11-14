// controllers/commentController.js
import Comment from "../models/Comment.js";
import Pin from "../models/Pin.js";

export const addComment = async (req, res) => {
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

    const populated = await Comment.findById(comment._id)
      .populate("user", "_id username profilePicture");

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getComments = async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    const comments = await Comment.find({ pin: pin._id })
      .populate("user", "_id username profilePicture")
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

    if (
      comment.user.toString() !== req.user._id.toString() &&
      pin.user.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this comment" });
    }

    await Comment.findByIdAndDelete(req.params.commentId);

    if (pin.commentsCount > 0) {
      pin.commentsCount -= 1;
      await pin.save();
    }

    res.status(200).json({ message: "Comment deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
