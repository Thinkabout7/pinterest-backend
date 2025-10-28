// models/Like.js
import mongoose from "mongoose";

const likeSchema = new mongoose.Schema(
  {
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
  },
  { timestamps: true }
);

// prevent duplicate likes on the same pin by the same user
likeSchema.index({ user: 1, pin: 1 }, { unique: true });

export default mongoose.model("Like", likeSchema);
