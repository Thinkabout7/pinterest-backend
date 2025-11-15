import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  createComment,
  getCommentsForPin,
  deleteComment,
  likeComment,
  unlikeComment,
} from "../controllers/commentController.js";

const router = express.Router();

// POST /api/pins/:pinId/comments - Create a comment or reply
router.post("/:pinId/comments", protect, createComment);

// GET /api/pins/:pinId/comments - Get comments for a pin with replies
router.get("/:pinId/comments", getCommentsForPin);

// DELETE /api/pins/comments/:commentId - Delete a comment
router.delete("/comments/:commentId", protect, deleteComment);

// POST /api/pins/comments/:commentId/likes - Like a comment
router.post("/comments/:commentId/likes", protect, likeComment);

// DELETE /api/pins/comments/:commentId/likes - Unlike a comment
router.delete("/comments/:commentId/likes", protect, unlikeComment);

export default router;
