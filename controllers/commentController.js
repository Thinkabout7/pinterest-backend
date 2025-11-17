import Comment from "../models/Comment.js";
import CommentLike from "../models/CommentLike.js";

// CREATE comment or reply
export const createComment = async (req, res) => {
  try {
    const { pinId, text, parentCommentId } = req.body;

    if (!text || !text.trim())
      return res.status(400).json({ message: "Text required" });

    const comment = await Comment.create({
      pin: pinId,
      user: req.user._id,
      text,
      replyToUser: parentCommentId ? (await Comment.findById(parentCommentId)).user : null,
    });

    const populated = await Comment.findById(comment._id)
      .populate("user", "username profilePicture")
      .populate("replyToUser", "username");

    res.status(201).json({
      _id: populated._id,
      text: populated.text,
      user: populated.user,
      replyToUsername: populated.replyToUser ? populated.replyToUser.username : null,
      createdAt: populated.createdAt,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// GET comments (threaded)
export const getCommentsForPin = async (req, res) => {
  try {
    const list = await Comment.find({ pin: req.params.pinId })
      .populate("user", "username profilePicture")
      .populate("replyToUser", "username")
      .sort({ createdAt: 1 })
      .lean();

    const map = {};
    const main = [];

    list.forEach((c) => {
      map[c._id] = {
        _id: c._id,
        text: c.text,
        user: c.user,
        likesCount: c.likesCount || 0,
        isLiked: false,
        createdAt: c.createdAt,
        replies: [],
        replyToUsername: c.replyToUser ? c.replyToUser.username : null,
      };
    });

    list.forEach((c) => {
      if (c.replies && c.replies.length > 0) {
        c.replies.forEach((replyId) => {
          if (map[replyId]) {
            map[c._id].replies.push(map[replyId]);
          }
        });
      } else if (!c.replyToUser) {
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

// TOGGLE like on comment
export const toggleLike = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const existing = await CommentLike.findOne({
      user: req.user._id,
      comment: comment._id,
    });

    if (existing) {
      await CommentLike.findByIdAndDelete(existing._id);
      comment.likesCount = Math.max(0, comment.likesCount - 1);
      await comment.save();
      res.json({ likesCount: comment.likesCount, isLiked: false });
    } else {
      await CommentLike.create({ user: req.user._id, comment: comment._id });
      comment.likesCount += 1;
      await comment.save();
      res.json({ likesCount: comment.likesCount, isLiked: true });
    }
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
