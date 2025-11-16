// routes/commentRoutes.js
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

// create comment or reply
router.post("/", protect, createComment);

// get threaded comments
router.get("/list/:pinId", getCommentsForPin);

// delete comment
router.delete("/:id", protect, deleteComment);

// like comment
router.post("/:commentId/like", protect, likeComment);

// unlike comment
router.delete("/:commentId/like", protect, unlikeComment);

// list users who reacted
router.get("/:commentId/likes", getCommentLikes);

export default router;
