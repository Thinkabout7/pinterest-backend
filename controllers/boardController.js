// controllers/boardController.js
import Board from "../models/Board.js";
import Pin from "../models/Pin.js";

// ============================================================
// GET /api/boards/:boardId  (Board details)
// ============================================================
export const getBoardById = async (req, res) => {
  try {
    const board = await Board.findById(req.params.boardId)
      .populate("pins")
      .populate("user");

    if (!board) return res.status(404).json({ message: "Board not found" });

    res.status(200).json(board);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ============================================================
// PUT /api/boards/:boardId  (Update board name/description/cover)
// ============================================================
export const updateBoard = async (req, res) => {
  try {
    const boardId = req.params.boardId;
    const { name, description, coverImage } = req.body;

    // Find board
    const board = await Board.findById(boardId);
    if (!board) return res.status(404).json({ message: "Board not found" });

    // Check ownership
    if (board.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Access denied" });

    // Apply updates
    if (name !== undefined) board.name = name;
    if (description !== undefined) board.description = description;
    if (coverImage !== undefined) board.coverImage = coverImage;

    await board.save();

    // ⭐ IMPORTANT: Return FULL board object
    const updatedBoard = await Board.findById(boardId)
      .populate("pins")
      .populate("user");

    return res.status(200).json({
      message: "Board updated successfully",
      board: updatedBoard,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================================================
// DELETE /api/boards/:boardId
// ============================================================
export const deleteBoard = async (req, res) => {
  try {
    const board = await Board.findById(req.params.boardId);

    if (!board) return res.status(404).json({ message: "Board not found" });

    if (board.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Access denied" });

    await board.deleteOne();

    res.status(200).json({ message: "Board deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ============================================================
// POST /api/boards/:boardId/pins/:pinId (Add pin to board)
// ============================================================
export const addPinToBoard = async (req, res) => {
  try {
    const { boardId, pinId } = req.params;

    const board = await Board.findById(boardId);
    const pin = await Pin.findById(pinId);

    if (!board || !pin)
      return res.status(404).json({ message: "Board or Pin not found" });

    if (board.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Access denied" });

    if (!board.pins.includes(pinId)) board.pins.push(pinId);

    // Auto-assign first pin as cover if no cover exists
    if (!board.coverImage) {
      board.coverImage = pin.mediaUrl || pin.image || null;
    }

    await board.save();

    const updatedBoard = await Board.findById(boardId)
      .populate("pins")
      .populate("user");

    res.status(200).json(updatedBoard);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ============================================================
// DELETE /api/boards/:boardId/pins/:pinId (Remove pin)
// ============================================================
export const removePinFromBoard = async (req, res) => {
  try {
    const { boardId, pinId } = req.params;

    const board = await Board.findById(boardId);

    if (!board) return res.status(404).json({ message: "Board not found" });

    if (board.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Access denied" });

    board.pins = board.pins.filter((id) => id.toString() !== pinId);

    // If removed pin was the cover, reset cover
    if (board.coverImage) {
      const firstPin = await Pin.findById(board.pins[0]);
      board.coverImage = firstPin ? firstPin.mediaUrl || firstPin.image : null;
    }

    await board.save();

    const updatedBoard = await Board.findById(boardId)
      .populate("pins")
      .populate("user");

    res.status(200).json(updatedBoard);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ============================================================
// Helper for assigning cover image
// ============================================================
export const autoAssignCover = async (boardId, pinImage) => {
  await Board.findByIdAndUpdate(
    boardId,
    { coverImage: pinImage },
    { new: true }
  );
};
