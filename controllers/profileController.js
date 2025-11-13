// controllers/profileController.js
import User from "../models/User.js";

export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ message: "User not found" });

    if (req.body.profilePicture !== undefined) {
      user.profilePicture = req.body.profilePicture;
    }

    await user.save();

    res.json({
      message: "Profile updated",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
      },
    });

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
