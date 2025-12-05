// routes/boardRoutes.js
import express from "express";
import Board from "../models/Board.js";
import Pin from "../models/Pin.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

/* ============================================================================
   CREATE BOARD (blocked if user is deactivated/deleted)
============================================================================ */
router.post("/", protect, async (req, res) => {
  try {
    if (req.user.isDeactivated || req.user.isDeleted) {
      return res.status(403).json({
        message: "Account is deactivated. Reactivate to continue.",
      });
    }

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

/* ============================================================================
   GET ALL BOARDS (hide boards of deactivated/deleted users)
============================================================================ */
router.get("/", protect, async (req, res) => {
  try {
    if (req.user.isDeleted) {
      return res.status(404).json({ message: "User not found" });
    }

    const boards = await Board.find({ user: req.user._id })
      .populate({
        path: "pins",
        populate: {
          path: "user",
          select: "username profilePicture isDeleted isDeactivated",
          match: { isDeleted: false, isDeactivated: false },
        },
      });

    // Hide pins whose owners are deactivated/deleted
    const cleanedBoards = boards.map((board) => ({
      ...board.toObject(),
      pins: board.pins.filter((p) => p && p.user),
    }));

    res.json(cleanedBoards);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ============================================================================
   GET A SINGLE BOARD (hide if board owner is deactivated/deleted)
============================================================================ */
router.get("/:boardId", protect, async (req, res) => {
  try {
    const board = await Board.findById(req.params.boardId)
      .populate({
        path: "user",
        select: "username profilePicture isDeleted isDeactivated",
      })
      .populate({
        path: "pins",
        populate: {
          path: "user",
          select: "username profilePicture isDeleted isDeactivated",
          match: { isDeleted: false, isDeactivated: false },
        },
      });

    if (!board || !board.user || board.user.isDeleted || board.user.isDeactivated) {
      return res.status(404).json({ message: "Board not found" });
    }

    // Remove pins whose owners are hidden
    const visiblePins = board.pins.filter((p) => p && p.user);

    res.json({ ...board.toObject(), pins: visiblePins });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ============================================================================
   UPDATE BOARD (blocked if user is deactivated/deleted)
============================================================================ */
router.put("/:boardId", protect, async (req, res) => {
  try {
    if (req.user.isDeactivated || req.user.isDeleted) {
      return res.status(403).json({
        message: "Account is deactivated. Reactivate to continue.",
      });
    }

    const board = await Board.findOneAndUpdate(
      { _id: req.params.boardId, user: req.user._id },
      req.body,
      { new: true }
    )
      .populate("pins")
      .populate("user");

    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    res.json(board);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ============================================================================
   ADD PIN TO BOARD (blocked if user OR pin owner is deactivated/deleted)
============================================================================ */
router.post("/:boardId/pins/:pinId", protect, async (req, res) => {
  try {
    if (req.user.isDeactivated || req.user.isDeleted) {
      return res.status(403).json({
        message: "Account is deactivated. Reactivate to continue.",
      });
    }

    const board = await Board.findOne({
      _id: req.params.boardId,
      user: req.user._id,
    });

    const pin = await Pin.findById(req.params.pinId).populate({
      path: "user",
      select: "isDeleted isDeactivated",
    });

    if (!board || !pin || !pin.user || pin.user.isDeleted || pin.user.isDeactivated) {
      return res.status(404).json({ message: "Board or Pin not found" });
    }

    if (!board.pins.includes(pin._id)) {
      board.pins.push(pin._id);
    }

    await board.save();

    res.json(board);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ============================================================================
   REMOVE PIN FROM BOARD
============================================================================ */
router.delete("/:boardId/pins/:pinId", protect, async (req, res) => {
  try {
    if (req.user.isDeactivated || req.user.isDeleted) {
      return res.status(403).json({
        message: "Account is deactivated. Reactivate to continue.",
      });
    }

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

/* ============================================================================
   DELETE BOARD (blocked if user is deactivated/deleted)
============================================================================ */
router.delete("/:boardId", protect, async (req, res) => {
  try {
    if (req.user.isDeactivated || req.user.isDeleted) {
      return res.status(403).json({
        message: "Account is deactivated. Reactivate to continue.",
      });
    }

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