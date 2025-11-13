// routes/profileRoutes.js
import express from "express";
import protect from "../middleware/authMiddleware.js";
import upload from "../middleware/upload.js";
import { updateProfile } from "../controllers/profileController.js";
import User from "../models/User.js";

const router = express.Router();

// Upload profile picture → CLOUDINARY
router.post(
  "/upload",
  protect,
  upload.single("profilePicture"),
  async (req, res) => {
    try {
      if (!req.file || !req.file.path) {
        return res.status(400).json({ message: "Upload failed" });
      }

      const imageUrl = req.file.path;

      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { profilePicture: imageUrl },
        { new: true }
      );

      res.status(200).json({
        message: "Profile picture updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Cloudinary upload error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);


router.put("/update", protect, updateProfile);

export default router;
