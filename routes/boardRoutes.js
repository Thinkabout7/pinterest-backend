// routes/boardRoutes.js
import express from "express";
import Board from "../models/Board.js";
import Pin from "../models/Pin.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// 🆕 Create a new board
router.post("/", protect, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: "Name required" });

    const board = await Board.create({
      name,
      description,
      user: req.user._id,
    });
    res.status(201).json(board);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 📋 Get all boards of the logged-in user
router.get("/", protect, async (req, res) => {
  try {
    const boards = await Board.find({ user: req.user._id }).populate(
      "pins",
      "title mediaUrl mediaType"
    );
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

// ✏ Update board (name, description, cover image)
router.put("/:boardId", protect, async (req, res) => {
  try {
    const { name, description, coverImage } = req.body;

    const board = await Board.findOne({
      _id: req.params.boardId,
      user: req.user._id,
    });
    if (!board) return res.status(404).json({ message: "Board not found" });

    if (name) board.name = name;
    if (description !== undefined) board.description = description;

    // if user uploads new cover, replace it
    if (coverImage) {
      board.coverImage = coverImage;
    } else if (!board.coverImage && board.pins.length > 0) {
      // if no cover set, use first pin as default
      const firstPin = await Pin.findById(board.pins[0]);
      if (firstPin?.mediaUrl) board.coverImage = firstPin.mediaUrl;
    }

    await board.save();
    res.status(200).json({ message: "Board updated", board });
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

    // if no cover image set, use this first pin
    if (!board.coverImage && pin.mediaUrl) {
      board.coverImage = pin.mediaUrl;
    }

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

    // If the removed pin was the cover, clear coverImage
    if (board.coverImage) {
      const pin = await Pin.findById(req.params.pinId);
      if (pin?.mediaUrl === board.coverImage) board.coverImage = "";
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