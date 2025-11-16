//commentRoutes.js
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

// create comment
router.post("/", protect, createComment);

// get comments
router.get("/list/:pinId", getCommentsForPin);

// delete comment
router.delete("/:id", protect, deleteComment);

// SYSTEM B — LIKE ROUTES
router.post("/:commentId/like", protect, likeComment);
router.delete("/:commentId/like", protect, unlikeComment);
router.get("/:commentId/likes", getCommentLikes);

export default router;
