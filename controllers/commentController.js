// controllers/commentController.js
import Comment from "../models/Comment.js";
import CommentLike from "../models/CommentLike.js";
import Pin from "../models/Pin.js";

// Create top-level comment
export const createComment = async (req, res) => {
  try {
    const { text } = req.body;
    const { pinId } = req.params;

    if (!text) {
      return res.status(400).json({ message: "Text is required" });
    }

    const pin = await Pin.findById(pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    const comment = await Comment.create({
      text,
      user: req.user._id,
      pin: pin._id,
      parentComment: null,
    });

    pin.commentsCount += 1;
    await pin.save();

    const populatedComment = await Comment.findById(comment._id).populate(
      "user",
      "username profilePicture"
    );

    res.status(201).json(populatedComment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create reply to ANY comment (top-level or reply)
export const createReply = async (req, res) => {
  try {
    const { text } = req.body;
    const { commentId } = req.params;

    if (!text) {
      return res.status(400).json({ message: "Reply text is required" });
    }

    const parentComment = await Comment.findById(commentId);
    if (!parentComment)
      return res.status(404).json({ message: "Parent comment not found" });

    const reply = await Comment.create({
      text,
      user: req.user._id,
      pin: parentComment.pin,
      parentComment: parentComment._id,
      replyToUser: parentComment.user,
    });

    const populatedReply = await Comment.findById(reply._id).populate(
      "user",
      "username profilePicture"
    );

    // increase pin comment count
    const pin = await Pin.findById(parentComment.pin);
    if (pin) {
      pin.commentsCount += 1;
      await pin.save();
    }

    res.status(201).json(populatedReply);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all comments for a pin as a tree (with replies)
export const getCommentsForPin = async (req, res) => {
  try {
    const { pinId } = req.params;

    const pin = await Pin.findById(pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    // Load all comments for this pin
    const allComments = await Comment.find({ pin: pin._id })
      .populate("user", "username profilePicture")
      .populate("replyToUser", "username")
      .sort({ createdAt: 1 })
      .lean();

    // Find which ones current user liked (if logged in)
    let likedIds = new Set();
    if (req.user) {
      const likes = await CommentLike.find({
        user: req.user._id,
        comment: { $in: allComments.map((c) => c._id) },
      }).lean();

      likedIds = new Set(likes.map((l) => l.comment.toString()));
    }

    // Build map and initialise replies array
    const map = new Map();
    allComments.forEach((c) => {
      map.set(c._id.toString(), {
        ...c,
        isLiked: likedIds.has(c._id.toString()),
        replies: [],
      });
    });

    const roots = [];

    // Attach each comment to its parent (if any)
    map.forEach((comment) => {
      if (comment.parentComment) {
        const parent = map.get(comment.parentComment.toString());
        if (parent) {
          parent.replies.push(comment);
        } // if parent missing, we just skip
      } else {
        roots.push(comment);
      }
    });

    res.status(200).json({ comments: roots });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a comment or reply (and all its children)
export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const pin = await Pin.findById(comment.pin);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    // Only comment owner or pin owner
    if (
      comment.user.toString() !== req.user._id.toString() &&
      pin.user.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this comment" });
    }

    // collect this comment + all descendants
    const idsToDelete = [comment._id];
    let idx = 0;

    while (idx < idsToDelete.length) {
      const children = await Comment.find(
        { parentComment: idsToDelete[idx] },
        "_id"
      );
      children.forEach((ch) => idsToDelete.push(ch._id));
      idx++;
    }

    // delete comments and their likes
    await Comment.deleteMany({ _id: { $in: idsToDelete } });
    await CommentLike.deleteMany({ comment: { $in: idsToDelete } });

    // decrease pin.commentsCount
    pin.commentsCount = Math.max(0, pin.commentsCount - idsToDelete.length);
    await pin.save();

    res.status(200).json({ message: "Comment deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
