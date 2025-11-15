// models/Comment.js
import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    pin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pin",
      required: true,
    },

    // null = top-level comment, otherwise it's a reply to another comment
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },

    // count of likes / reactions on this comment
    likesCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Comment", commentSchema);
