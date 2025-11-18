// routes/commentRoutes.js
import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  createComment,
  getCommentsForPin,
  deleteComment,
  toggleLike,
  getCommentLikes,
} from "../controllers/commentController.js";

const router = express.Router();

// Create comment or reply
router.post("/", protect, createComment);

// Get threaded comments for a pin
router.get("/pin/:pinId", protect, getCommentsForPin);

// Delete comment + all its replies
router.delete("/:id", protect, deleteComment);

// Toggle like on comment
router.post("/:commentId/like", protect, toggleLike);

// Get users who liked a comment (for reactions modal)
router.get("/:commentId/likes", getCommentLikes);

export default router;
