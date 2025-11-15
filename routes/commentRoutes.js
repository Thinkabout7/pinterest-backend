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

const router = express.Router();

// list comments for a pin (nested tree)
router.get("/list/:pinId", getCommentsForPin);

// create top-level comment
router.post("/", protect, createComment);

// create reply to any comment
router.post("/reply/:commentId", protect, createReply);

// delete comment + replies
router.delete("/:commentId", protect, deleteComment);

// like / unlike / list likes
router.post("/like/:commentId", protect, likeComment);
router.delete("/like/:commentId", protect, unlikeComment);
router.get("/likes/:commentId", getCommentLikes);

export default router;
