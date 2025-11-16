import express from "express";
import Board from "../models/Board.js";
import Pin from "../models/Pin.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// Create board
router.post("/", protect, async (req, res) => {
  try {
    const board = await Board.create({
      name: req.body.name,
      description: req.body.description,
      user: req.user._id,
      coverImage: "",
    });

    res.status(201).json(board);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all boards
router.get("/", protect, async (req, res) => {
  try {
    const boards = await Board.find({ user: req.user._id }).populate(
      "pins",
      "title mediaUrl mediaType"
    );
    res.json(boards);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get one board
router.get("/:boardId", protect, async (req, res) => {
  try {
    const board = await Board.findOne({
      _id: req.params.boardId,
      user: req.user._id,
    })
      .populate("pins")
      .populate("user");

    if (!board) return res.status(404).json({ message: "Board not found" });

    res.json(board);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update (name, description, cover)
router.put("/:boardId", protect, async (req, res) => {
  try {
    const updated = await Board.findOneAndUpdate(
      { _id: req.params.boardId, user: req.user._id },
      req.body,
      { new: true }
    )
      .populate("pins")
      .populate("user");

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add pin
router.post("/:boardId/pins/:pinId", protect, async (req, res) => {
  try {
    const board = await Board.findOne({
      _id: req.params.boardId,
      user: req.user._id,
    });

    const pin = await Pin.findById(req.params.pinId);

    if (!board || !pin)
      return res.status(404).json({ message: "Board or Pin not found" });

    if (!board.pins.includes(pin._id)) board.pins.push(pin._id);

    await board.save();
    res.json(board);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove pin
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

    await board.save();
    res.json(board);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete board
router.delete("/:boardId", protect, async (req, res) => {
  try {
    const board = await Board.findOneAndDelete({
      _id: req.params.boardId,
      user: req.user._id,
    });

    if (!board) return res.status(404).json({ message: "Board not found" });

    res.json({ message: "Board deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
