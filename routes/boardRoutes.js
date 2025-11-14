// routes/boardRoutes.js
import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";

import Board from "../models/Board.js";
import Pin from "../models/Pin.js";
import protect from "../middleware/authMiddleware.js";
import { updateBoard } from "../controllers/boardController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Ensure upload folder exists ===
const uploadDir = path.join(__dirname, "../uploads/boards");
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

// 🆕 Create a new board
router.post("/", protect, upload.single("coverImage"), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: "Name required" });

    const coverImage = req.file
      ? `/uploads/boards/${req.file.filename}`
      : null;

    const board = await Board.create({
      name,
      description,
      user: req.user._id,
      coverImage,
    });

    res.status(201).json(board);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 📋 Get all boards for the logged-in user
router.get("/", protect, async (req, res) => {
  try {
    const boards = await Board.find({ user: req.user._id })
      .populate("pins", "title mediaUrl mediaType")
      .sort({ createdAt: -1 });

    res.status(200).json(boards);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 📖 Get a single board by ID
router.get("/:boardId", protect, async (req, res) => {
  try {
    const board = await Board.findOne({
      _id: req.params.boardId,
      user: req.user._id,
    })
      .populate("pins", "title mediaUrl mediaType")
      .populate("user", "username profilePicture");

    if (!board) return res.status(404).json({ message: "Board not found" });
    res.status(200).json(board);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✏ Update a board (rename, description, or cover image)
router.put("/:boardId", protect, async (req, res) => {
  try {
    const boardId = req.params.boardId;
    const { name, description, coverImage } = req.body;

    const board = await Board.findOne({
      _id: boardId,
      user: req.user._id,
    });
    if (!board) return res.status(404).json({ message: "Board not found" });

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    if (coverImage) {
      updateData.coverImage = coverImage;
    }

    const updatedBoard = await Board.findOneAndUpdate(
      { _id: boardId, user: req.user._id },
      updateData,
      { new: true }
    )
      .populate("pins")
      .populate("user");

    if (!updatedBoard) return res.status(404).json({ message: "Board not found" });

    res.status(200).json({ board: updatedBoard });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 📌 Add a pin to a board
router.post("/:boardId/pins/:pinId", protect, async (req, res) => {
  try {
    const board = await Board.findOne({
      _id: req.params.boardId,
      user: req.user._id,
    });
    if (!board) return res.status(404).json({ message: "Board not found" });

    const pin = await Pin.findById(req.params.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    if (board.pins.includes(pin._id))
      return res.status(400).json({ message: "Pin already in board" });

    board.pins.push(pin._id);

    // if no cover image yet, use first pin media
    if (!board.coverImage && pin.mediaUrl) board.coverImage = pin.mediaUrl;

    await board.save();
    res.status(200).json(board);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ❌ Remove a pin from a board
router.delete("/:boardId/pins/:pinId", protect, async (req, res) => {
  try {
    const board = await Board.findOne({
      _id: req.params.boardId,
      user: req.user._id,
    });
    if (!board) return res.status(404).json({ message: "Board not found" });

    board.pins = board.pins.filter(
      (p) => p.toString() !== req.params.pinId.toString()
    );

    // if that pin was the cover, clear it
    const removedPin = await Pin.findById(req.params.pinId);
    if (removedPin?.mediaUrl === board.coverImage) {
      board.coverImage = "";
    }

    await board.save();
    res.status(200).json({ message: "Pin removed from board", board });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🗑 Delete a board
router.delete("/:boardId", protect, async (req, res) => {
  try {
    const board = await Board.findOneAndDelete({
      _id: req.params.boardId,
      user: req.user._id,
    });
    if (!board) return res.status(404).json({ message: "Board not found" });
    res.status(200).json({ message: "Board deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;