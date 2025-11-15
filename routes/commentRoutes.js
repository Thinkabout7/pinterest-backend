// routes/commentRoutes.js
import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  createComment,
  getCommentsForPin,
  deleteComment,
  likeComment,
} from "../controllers/commentController.js";
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

// Create comment or reply
router.post("/", protect, createComment);

// Get comments for a pin
router.get("/:pinId", optionalAuth, getCommentsForPin);

// Delete comment
router.delete("/:id", protect, deleteComment);

// Like / Unlike comment
router.patch("/:commentId/like", protect, likeComment);

export default router;
