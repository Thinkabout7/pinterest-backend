// controllers/profileController.js
import User from "../models/User.js";

export const updateProfile = async (req, res) => {
  try {
    const updates = {};

    if (req.body.profilePicture !== undefined) {
      updates.profilePicture = req.body.profilePicture; // "" clears image
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true }
    );

    return res.status(200).json({
      message: "Profile updated",
      user: updatedUser,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
