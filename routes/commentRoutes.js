import express from "express";
import protect from "../middleware/authMiddleware.js";

import {
  createComment,
  getCommentsForPin,
  deleteComment,
} from "../controllers/commentController.js";

import {
  likeComment,
  unlikeComment,
  getCommentLikes,
} from "../controllers/commentLikeController.js";

const router = express.Router();

// Create a comment
router.post("/", protect, createComment);

// Get comments for a pin
router.get("/list/:pinId", getCommentsForPin);

// Delete a comment
router.delete("/:id", protect, deleteComment);

// Like a comment
router.post("/:commentId/like", protect, likeComment);

// Unlike a comment
router.delete("/:commentId/like", protect, unlikeComment);

// Get users who liked a comment
router.get("/:commentId/likes", getCommentLikes);

export default router;
