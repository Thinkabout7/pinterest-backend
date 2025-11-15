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

    const comment = await Comment.create({
      pinId,
      userId: req.user._id,
      text,
      parentCommentId: parentCommentId || null,
    });

    // Update comment count
    const totalCount = await Comment.countDocuments({ pinId });
    await Pin.findByIdAndUpdate(pinId, { commentsCount: totalCount });

    const populatedComment = await Comment.findById(comment._id).populate(
      "userId",
      "username profilePicture"
    );

    res.status(201).json(populatedComment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get comments for a pin
export const getCommentsForPin = async (req, res) => {
  try {
    const { pinId } = req.params;

    const pin = await Pin.findById(pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    // Get all comments for the pin
    const allComments = await Comment.find({ pinId })
      .populate("userId", "username profilePicture")
      .sort({ createdAt: 1 })
      .lean();

    // Build tree
    const commentMap = new Map();
    const mainComments = [];

    allComments.forEach((comment) => {
      const commentObj = {
        _id: comment._id,
        text: comment.text,
        user: comment.userId,
        likesCount: comment.likes.length,
        isLiked: req.user ? comment.likes.includes(req.user._id.toString()) : false,
        createdAt: comment.createdAt,
        replies: [],
      };

      commentMap.set(comment._id.toString(), commentObj);

      if (!comment.parentCommentId) {
        mainComments.push(commentObj);
      }
    });

    // Attach replies
    allComments.forEach((comment) => {
      if (comment.parentCommentId) {
        const parent = commentMap.get(comment.parentCommentId.toString());
        if (parent) {
          const replyObj = commentMap.get(comment._id.toString());
          replyObj.parentUsername = parent.user.username;
          replyObj.parentUserId = parent.user._id;
          parent.replies.push(replyObj);
        }
      }
    });

    // Sort main comments by newest first
    mainComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Sort replies by oldest first
    mainComments.forEach((main) => {
      main.replies.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    });

    const totalCount = allComments.length;

    res.status(200).json({ mainComments, totalCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete comment
export const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;

    const comment = await Comment.findById(id);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const pin = await Pin.findById(comment.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    // Only comment owner or pin owner
    if (
      comment.userId.toString() !== req.user._id.toString() &&
      pin.user.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Collect all descendants
    const idsToDelete = [id];
    let idx = 0;

    while (idx < idsToDelete.length) {
      const children = await Comment.find(
        { parentCommentId: idsToDelete[idx] },
        "_id"
      );
      children.forEach((ch) => idsToDelete.push(ch._id));
      idx++;
    }

    // Delete all
    await Comment.deleteMany({ _id: { $in: idsToDelete } });

    // Update comment count
    const totalCount = await Comment.countDocuments({ pinId: comment.pinId });
    await Pin.findByIdAndUpdate(comment.pinId, { commentsCount: totalCount });

    res.status(200).json({ message: "Comment deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Like / Unlike comment
export const likeComment = async (req, res) => {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const userIdStr = req.user._id.toString();
    const likes = comment.likes.map((id) => id.toString());

    if (likes.includes(userIdStr)) {
      // Unlike
      comment.likes = comment.likes.filter((id) => id.toString() !== userIdStr);
    } else {
      // Like
      comment.likes.push(req.user._id);
    }

    await comment.save();

    res.status(200).json({ likesCount: comment.likes.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// controllers/commentController.jss