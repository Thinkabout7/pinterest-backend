//commentRoutes.js

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

const router = express.Router();

// POST /api/comments/:pinId - Create a top-level comment
router.post("/:pinId", protect, createComment);

// POST /api/comments/reply/:commentId - Create a reply to a comment
router.post("/reply/:commentId", protect, createReply);

// GET /api/comments/list/:pinId - Get all comments and replies for a pin
router.get("/list/:pinId", getCommentsForPin);

// DELETE /api/comments/:commentId - Delete a comment
router.delete("/:commentId", protect, deleteComment);

// POST /api/comments/like/:commentId - Like a comment
router.post("/like/:commentId", protect, likeComment);

// DELETE /api/comments/like/:commentId - Unlike a comment
router.delete("/like/:commentId", protect, unlikeComment);

// GET /api/comments/likes/:commentId - Get users who liked a comment
router.get("/likes/:commentId", getCommentLikes);

export default router;
