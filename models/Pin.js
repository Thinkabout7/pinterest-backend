//Pin.js
import mongoose from "mongoose";

const PinSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      default: ""   //optional
    },
    description: {
      type: String,
      trim: true,
      default: ""   //optional
    },
    category: {
      type: String,
      default: "",
    },
    mediaUrl: {
      type: String,
      required: true,
    },
    mediaType: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Board",
    },
    likesCount: {
      type: Number,
      default: 0,
    },
    commentsCount: {
      type: Number,
      default: 0,
    },

    // NEW FIELD
    tags: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model("Pin", PinSchema);
