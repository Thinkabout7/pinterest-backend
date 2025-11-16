// controllers/commentController.js
import Comment from "../models/Comment.js";

// CREATE comment or reply
export const createComment = async (req, res) => {
  try {
    const { pinId, text, parentCommentId } = req.body;

    if (!text || !text.trim())
      return res.status(400).json({ message: "Text required" });

    let replyToUsername = null;

    // If replying → find parent to extract username
    if (parentCommentId) {
      const parent = await Comment.findById(parentCommentId).populate(
        "userId",
        "username"
      );
      if (parent) replyToUsername = parent.userId.username;
    }

    const comment = await Comment.create({
      pinId,
      userId: req.user._id,
      text,
      parentCommentId: parentCommentId || null,
      replyToUsername: replyToUsername || null,
      likesCount: 0,
    });

    const populated = await Comment.findById(comment._id).populate(
      "userId",
      "username profilePicture"
    );

    res.status(201).json(populated);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// GET comments (threaded)
export const getCommentsForPin = async (req, res) => {
  try {
    const list = await Comment.find({ pinId: req.params.pinId })
      .populate("userId", "username profilePicture")
      .sort({ createdAt: 1 })
      .lean();

    const map = {};
    const main = [];

    list.forEach((c) => {
      map[c._id] = {
        _id: c._id,
        text: c.text,
        user: c.userId,
        likesCount: c.likesCount || 0,
        isLiked: false,
        createdAt: c.createdAt,
        replies: [],
        parentCommentId: c.parentCommentId || null,
        replyToUsername: c.replyToUsername || null,
      };
    });

    list.forEach((c) => {
      if (c.parentCommentId) {
        if (map[c.parentCommentId]) {
          map[c.parentCommentId].replies.push(map[c._id]);
        }
      } else {
        main.push(map[c._id]);
      }
    });

    res.status(200).json({ comments: main, totalCount: list.length });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// DELETE comment
export const deleteComment = async (req, res) => {
  try {
    await Comment.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
