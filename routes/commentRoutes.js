
//routes/commentRoutes.js
import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  createComment,
  getCommentsForPin,
  deleteComment,
  toggleLike,
} from "../controllers/commentController.js";

import { getCommentLikes } from "../controllers/commentLikeController.js";

const router = express.Router();

// CREATE comment or reply
router.post("/", protect, createComment);

// GET threaded comments
router.get("/list/:pinId", protect, getCommentsForPin);

// DELETE comment
router.delete("/:id", protect, deleteComment);

// LIKE / UNLIKE toggle
router.post("/:commentId/like", protect, toggleLike);

// GET users who liked comment
router.get("/:commentId/likes", getCommentLikes);

export default router;
