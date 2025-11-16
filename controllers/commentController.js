// controllers/commentController.js
import Comment from "../models/Comment.js";
import Pin from "../models/Pin.js";

// Create comment or reply
export const createComment = async (req, res) => {
  try {
    const { pinId, text, parentCommentId } = req.body;

    if (!pinId || !text) {
      return res.status(400).json({ message: "pinId and text are required" });
    }

    const pin = await Pin.findById(pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    // create comment
    const comment = await Comment.create({
      pinId,
      userId: req.user._id,
      text,
      parentCommentId: parentCommentId || null,
    });

    // update count in Pin
    const totalCount = await Comment.countDocuments({ pinId });
    await Pin.findByIdAndUpdate(pinId, { commentsCount: totalCount });

    const populated = await Comment.findById(comment._id)
      .populate("userId", "username profilePicture");

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Fetch comments
export const getCommentsForPin = async (req, res) => {
  try {
    const { pinId } = req.params;

    const all = await Comment.find({ pinId })
      .populate("userId", "username profilePicture")
      .sort({ createdAt: 1 })
      .lean();

    const commentMap = new Map();
    const main = [];

    all.forEach((c) => {
      const obj = {
        _id: c._id,
        text: c.text,
        user: c.userId,
        likesCount: c.likesCount,
        createdAt: c.createdAt,
        replies: [],
      };

      commentMap.set(c._id.toString(), obj);
      if (!c.parentCommentId) main.push(obj);
    });

    all.forEach((c) => {
      if (c.parentCommentId) {
        const parent = commentMap.get(c.parentCommentId.toString());
        if (parent) {
          parent.replies.push(commentMap.get(c._id.toString()));
        }
      }
    });

    main.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ mainComments: main });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete comment + replies
export const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;

    const comment = await Comment.findById(id);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    if (
      comment.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Not allowed" });
    }

    const ids = [id];
    let idx = 0;

    while (idx < ids.length) {
      const children = await Comment.find({ parentCommentId: ids[idx] });
      children.forEach((c) => ids.push(c._id.toString()));
      idx++;
    }

    await Comment.deleteMany({ _id: { $in: ids } });

    const totalCount = await Comment.countDocuments({ pinId: comment.pinId });
    await Pin.findByIdAndUpdate(comment.pinId, { commentsCount: totalCount });

    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
