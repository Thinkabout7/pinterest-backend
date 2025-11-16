// commentRoutes.js
import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  createComment,
  getCommentsForPin,
  deleteComment,
  likeComment as likeA,
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

/* ------------------------------------------
   LIKE SYSTEM — FIXED (supports BOTH)
------------------------------------------- */

// FRONTEND EXPECTS THIS:
router.patch("/:commentId/like", protect, likeA);

// SYSTEM B — ALSO KEEP THESE:
router.post("/:commentId/like", protect, likeComment);
router.delete("/:commentId/like", protect, unlikeComment);

// get list of users who reacted
router.get("/:commentId/likes", getCommentLikes);

export default router;
