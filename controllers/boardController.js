// controllers/boardController.js
import Board from "../models/Board.js";
import Pin from "../models/Pin.js";

// PUT /api/boards/:boardId
export const updateBoard = async (req, res) => {
  try {
    const boardId = req.params.boardId;
    const { name, description, coverImage } = req.body;

    const board = await Board.findById(boardId);
    if (!board) return res.status(404).json({ message: "Board not found" });
    if (board.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Access denied" });

    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (coverImage) {
      updateData.coverImage = coverImage;
    }

    const updatedBoard = await Board.findByIdAndUpdate(
      boardId,
      updateData,
      { new: true }
    );

    if (!updatedBoard) return res.status(404).json({ message: "Board not found" });

    res.status(200).json({
      message: "Board updated successfully",
      board: updatedBoard,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Auto-assign first pin as cover
export const autoAssignCover = async (boardId, pinImage) => {
  const updatedBoard = await Board.findByIdAndUpdate(
    boardId,
    { coverImage: pinImage },
    { new: true }
  );
  // Note: This function assumes pinImage is provided and board exists
};
