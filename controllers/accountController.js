// controllers/accountController.js
import User from "../models/User.js";
import Pin from "../models/Pin.js";
import Board from "../models/Board.js";
import SavedPin from "../models/SavedPin.js";
import Like from "../models/Like.js";
import CommentLike from "../models/CommentLike.js";
import Comment from "../models/Comment.js";
import Notification from "../models/Notification.js";


// --------------------------------------------------------
// 🔹 1. DEACTIVATE ACCOUNT
// --------------------------------------------------------
export const deactivateAccount = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isDeactivated: true });

    return res.status(200).json({
      success: true,
      message: "Account deactivated successfully.",
    });
  } catch (err) {
    console.error("Deactivate error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


// --------------------------------------------------------
// 🔹 2. REACTIVATE ACCOUNT
// --------------------------------------------------------
export const reactivateAccount = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isDeactivated: false });

    return res.status(200).json({
      success: true,
      message: "Account reactivated successfully.",
    });
  } catch (err) {
    console.error("Reactivate error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


// --------------------------------------------------------
// 🔹 3. DELETE ACCOUNT (SOFT DELETE + FULL CLEANUP + RELEASE EMAIL/USERNAME)
// --------------------------------------------------------
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch user to get their email + username
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create new values so username & email become FREE for reuse
    const newEmail = `deleted_${userId}_${Date.now()}@deleted.local`;
    const newUsername = `deleted_user_${userId}_${Date.now()}`;

    // Mark user as deleted + release their email/username
    await User.findByIdAndUpdate(userId, {
      isDeleted: true,
      email: newEmail,
      username: newUsername
    });

    // ---- DELETE all user's pins ----
    await Pin.deleteMany({ user: userId });

    // ---- DELETE all boards ----
    await Board.deleteMany({ user: userId });

    // ---- DELETE all saved pins ----
    await SavedPin.deleteMany({ user: userId });

    // ---- DELETE likes created by this user ----
    await Like.deleteMany({ user: userId });

    // ---- DELETE comment likes created by this user ----
    await CommentLike.deleteMany({ user: userId });

    // ---- DELETE comments made by user ----
    await Comment.deleteMany({ user: userId });

    // ---- Remove user from FOLLOWERS and FOLLOWING lists ----
    await User.updateMany(
      { followers: userId },
      { $pull: { followers: userId } }
    );

    await User.updateMany(
      { following: userId },
      { $pull: { following: userId } }
    );

    // ---- DELETE all notifications involving this user ----
    await Notification.deleteMany({
      $or: [{ sender: userId }, { recipient: userId }],
    });

    return res.status(200).json({
      success: true,
      message: "Account deleted successfully. Email & username are now available for reuse.",
    });
  } catch (err) {
    console.error("Delete account error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

