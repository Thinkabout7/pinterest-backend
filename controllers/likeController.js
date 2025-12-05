// controllers/likeController.js
import Like from "../models/Like.js";
import Pin from "../models/Pin.js";
import Notification from "../models/Notification.js";

export const likePin = async (req, res) => {
  try {
    // BLOCK deactivated/deleted users
    if (req.user?.isDeactivated || req.user?.isDeleted) {
      return res
        .status(403)
        .json({ message: "Account is deactivated. Reactivate to continue." });
    }

    const pin = await Pin.findById(req.params.pinId).populate({
      path: "user",
      select: "isDeactivated isDeleted",
    });

    // Hide pins owned by deactivated/deleted users
    if (!pin || !pin.user || pin.user.isDeactivated || pin.user.isDeleted) {
      return res.status(404).json({ message: "Pin not found" });
    }

    const existing = await Like.findOne({
      user: req.user._id,
      pin: pin._id,
    });

    if (existing) {
      return res.status(400).json({ message: "Already liked" });
    }

    await Like.create({ user: req.user._id, pin: pin._id });

    pin.likesCount += 1;
    await pin.save();

    if (String(pin.user._id) !== String(req.user._id)) {
      await Notification.create({
        recipient: pin.user._id,
        sender: req.user._id,
        type: "like",
        pin: pin._id,
        message: `${req.user.username} liked your pin "${pin.title}".`,
      });
    }

    res.status(201).json({ message: "Liked successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const unlikePin = async (req, res) => {
  try {
    // BLOCK deactivated/deleted users
    if (req.user?.isDeactivated || req.user?.isDeleted) {
      return res
        .status(403)
        .json({ message: "Account is deactivated. Reactivate to continue." });
    }

    const like = await Like.findOneAndDelete({
      user: req.user._id,
      pin: req.params.pinId,
    });

    if (!like) return res.status(404).json({ message: "Like not found" });

    const pin = await Pin.findById(req.params.pinId);
    if (pin && pin.likesCount > 0) {
      pin.likesCount -= 1;
      await pin.save();
    }

    res.status(200).json({ message: "Unliked successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPinLikes = async (req, res) => {
  try {
    // BLOCK deactivated/deleted users
    if (req.user?.isDeactivated || req.user?.isDeleted) {
      return res
        .status(403)
        .json({ message: "Account is deactivated. Reactivate to continue." });
    }

    const pin = await Pin.findById(req.params.pinId).populate({
      path: "user",
      select: "isDeactivated isDeleted",
    });

    if (!pin || !pin.user || pin.user.isDeactivated || pin.user.isDeleted) {
      return res.status(404).json({ message: "Pin not found" });
    }

    const likes = await Like.find({ pin: pin._id }).populate({
      path: "user",
      select: "_id username profilePicture isDeactivated isDeleted",
      match: { isDeactivated: false, isDeleted: false },
    });

    const users = likes.map((l) => l.user).filter(Boolean);

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
