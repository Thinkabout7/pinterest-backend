// routes/profileRoutes.js
import express from "express";
import protect from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";
import User from "../models/User.js";
import { updateProfile } from "../controllers/profileController.js";

const router = express.Router();

// Upload Profile Picture → Returns fileUrl + updated user
router.post(
  "/upload",
  protect,
  upload.single("profilePicture"),
  async (req, res) => {
    try {
      if (!req.file || !req.file.path) {
        return res.status(400).json({ message: "Upload failed" });
      }

      // Cloudinary URL
      const fileUrl = req.file.path;

      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { profilePicture: fileUrl },
        { new: true }
      );

      return res.status(200).json({
        fileUrl,                // ⭐ IMPORTANT: FRONTEND EXPECTS THIS
        user: updatedUser,
      });
    } catch (error) {
      console.error("Upload error:", error);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

// Profile updates via JSON
router.put("/update", protect, updateProfile);

export default router;
