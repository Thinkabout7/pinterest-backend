// models/Comment.js
import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
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
    // null = top-level comment
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    // for fast population of first-level replies
    replies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
    likesCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Comment", commentSchema);
