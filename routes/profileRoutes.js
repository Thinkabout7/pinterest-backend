// routes/profileRoutes.js
import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";
import User from "../models/User.js";
import Pin from "../models/Pin.js";
import Board from "../models/Board.js";
import protect from "../middleware/authMiddleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Ensure upload folder exists ===
const uploadDir = path.join(__dirname, "../uploads/profile");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// === Multer configuration ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + file.originalname;
    cb(null, unique);
  },
});

const upload = multer({ storage });

const router = express.Router();

// 👤 Get public profile info
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("followers", "username avatar")
      .populate("following", "username avatar");

    if (!user) return res.status(404).json({ message: "User not found" });

    const pins = await Pin.find({ user: user._id }).sort({ createdAt: -1 });
    const boards = await Board.find({ user: user._id }).sort({ createdAt: -1 });

    res.status(200).json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        followersCount: user.followers.length,
        followingCount: user.following.length,
      },
      pins,
      boards,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 📸 Upload profile picture
router.post("/upload", protect, upload.single("profilePicture"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const fileUrl = `/uploads/profile/${req.file.filename}`;

    req.user.profilePicture = fileUrl;
    await req.user.save();

    res.status(200).json({
      message: "File uploaded",
      fileUrl,
      user: req.user,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✏ Update profile (including profile picture via URL)
router.put("/", protect, async (req, res) => {
  try {
    const { username, email, profilePicture } = req.body;

    if (username) req.user.username = username;
    if (email) req.user.email = email;
    if (profilePicture !== undefined) req.user.profilePicture = profilePicture;

    await req.user.save();

    res.status(200).json({
      message: "Profile updated",
      user: req.user,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
