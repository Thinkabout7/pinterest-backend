// routes/likeRoutes.js
import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  likePin,
  unlikePin,
  getPinLikes,
} from "../controllers/likeController.js";

const router = express.Router();

// ❤ Like a pin
router.post("/:pinId", protect, likePin);

// 💔 Unlike a pin
router.delete("/:pinId", protect, unlikePin);

// 👥 Get users who liked a pin  (filtered for deactivated users)
router.get("/:pinId/users", protect, getPinLikes);

// 🔢 Get like count only
router.get("/:pinId", async (req, res) => {
  try {
    const result = await getPinLikes(req, res); // reuse controller logic
    if (!result || !Array.isArray(result)) return; 
  } catch (err) {
    console.error("Like count error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;