// models/Board.js
import mongoose from "mongoose";

const boardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    coverImage: { type: String, trim: true }, // 👈 Added
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    pins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Pin",
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Board", boardSchema);