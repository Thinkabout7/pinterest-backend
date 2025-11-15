// controllers/commentController.js
import Comment from "../models/Comment.js";
import CommentLike from "../models/CommentLike.js";
import Pin from "../models/Pin.js";

// helper: build nested tree from flat list
const buildCommentTree = (flatComments) => {
  const map = new Map();
  const roots = [];

  flatComments.forEach((c) => {
    map.set(String(c._id), { ...c, replies: [] });
  });

  map.forEach((comment) => {
    if (comment.parentComment) {
      const parent = map.get(String(comment.parentComment));
      if (parent) {
        parent.replies.push(comment);
      }
    } else {
      roots.push(comment);
    }
  });

  return roots;
};

export const createComment = async (req, res) => {
  try {
    const { text, pinId } = req.body;

    if (!text || !pinId) {
      return res
        .status(400)
        .json({ message: "Text and pinId are required for a comment" });
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

    const populated = await Comment.findById(comment._id).populate(
      "user",
      "_id username profilePicture"
    );

    return res.status(201).json(populated);
  } catch (error) {
    console.error("createComment error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const createReply = async (req, res) => {
  try {
    const { text } = req.body;
    const { commentId } = req.params;

    if (!text) {
      return res
        .status(400)
        .json({ message: "Reply text is required" });
    }

    const parentComment = await Comment.findById(commentId);
    if (!parentComment) {
      return res.status(404).json({ message: "Parent comment not found" });
    }

    const reply = await Comment.create({
      text,
      user: req.user._id,
      pin: parentComment.pin,
      parentComment: parentComment._id,
    });

    parentComment.replies.push(reply._id);
    await parentComment.save();

    // increment pin.commentsCount for replies as well
    const pin = await Pin.findById(parentComment.pin);
    if (pin) {
      pin.commentsCount += 1;
      await pin.save();
    }

    const populated = await Comment.findById(reply._id).populate(
      "user",
      "_id username profilePicture"
    );

    return res.status(201).json(populated);
  } catch (error) {
    console.error("createReply error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getCommentsForPin = async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    const flatComments = await Comment.find({ pin: pin._id })
      .populate("user", "_id username profilePicture")
      .sort({ createdAt: 1 })
      .lean();

    const tree = buildCommentTree(flatComments);

    return res.status(200).json({ comments: tree });
  } catch (error) {
    console.error("getCommentsForPin error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const pin = await Pin.findById(comment.pin);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    // only comment owner or pin owner can delete
    if (
      String(comment.user) !== String(req.user._id) &&
      String(pin.user) !== String(req.user._id)
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this comment" });
    }

    // find all descendants (comment + nested replies)
    const allComments = await Comment.find({ pin: pin._id }).select(
      "_id parentComment"
    );
    const toDelete = new Set([String(comment._id)]);

    let changed = true;
    while (changed) {
      changed = false;
      for (const c of allComments) {
        if (
          c.parentComment &&
          toDelete.has(String(c.parentComment)) &&
          !toDelete.has(String(c._id))
        ) {
          toDelete.add(String(c._id));
          changed = true;
        }
      }
    }

    const idsArray = Array.from(toDelete);

    // delete likes for all those comments
    await CommentLike.deleteMany({ comment: { $in: idsArray } });

    // delete comments
    await Comment.deleteMany({ _id: { $in: idsArray } });

    // remove from parent's replies if needed
    if (comment.parentComment) {
      await Comment.findByIdAndUpdate(comment.parentComment, {
        $pull: { replies: comment._id },
      });
    }

    // reduce pin.commentsCount but not below 0
    const deleteCount = idsArray.length;
    pin.commentsCount = Math.max(0, pin.commentsCount - deleteCount);
    await pin.save();

    return res
      .status(200)
      .json({ message: "Comment and its replies deleted" });
  } catch (error) {
    console.error("deleteComment error:", error);
    res.status(500).json({ message: error.message });
  }
};
