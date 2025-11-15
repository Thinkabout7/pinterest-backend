// routes/commentRoutes.js
import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  createComment,
  createReply,
  getCommentsForPin,
  deleteComment,
} from "../controllers/commentController.js";
import {
  likeComment,
  unlikeComment,
  getCommentLikes,
} from "../controllers/commentLikeController.js";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

// optional auth (for list route – so we can mark isLiked if logged in)
const optionalAuth = async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
    } catch (err) {
      // ignore invalid token
    }
  }
  next();
};

// Create top-level comment
router.post("/", protect, createComment);

// Create reply to any comment
router.post("/reply/:commentId", protect, createReply);

// Get comments for a pin (tree)
router.get("/list/:pinId", optionalAuth, getCommentsForPin);

// Delete comment or reply
router.delete("/:commentId", protect, deleteComment);

// Like / Unlike / Get likes for a comment
router.post("/like/:commentId", protect, likeComment);
router.delete("/like/:commentId", protect, unlikeComment);
router.get("/likes/:commentId", getCommentLikes);

export default router;
