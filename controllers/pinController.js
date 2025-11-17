import Pin from "../models/Pin.js";
import Like from "../models/Like.js";
import Notification from "../models/Notification.js";
import { autoAssignCover } from "./boardController.js"; // adjust path if needed
import axios from "axios";

// 🧃 Create a new pin
export const createPin = async (req, res) => {
  try {
    const { title, description, category, boardId } = req.body;

    if (!req.file?.path) {
      return res
        .status(400)
        .json({ message: "Media file is required (image or video)" });
    }

    const mediaType = /^video\//i.test(req.file.mimetype) ? "video" : "image";

    const newPin = new Pin({
      title,
      description,
      category,
      mediaUrl: req.file.path,
      mediaType,
      user: req.user._id,
      boardId,
    });

    const savedPin = await newPin.save();

    if (boardId) {
      await autoAssignCover(boardId, req.file.path);
    }

    res.status(201).json(savedPin);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// 🍱 Get all pins (simple list)
export const getAllPins = async (req, res) => {
  try {
    const pins = await Pin.find()
      .populate("user", "username email profilePicture")
      .sort({ createdAt: -1 });

    res.status(200).json(pins);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🧊 Get only the pin document (simple, old endpoint)
export const getPinById = async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.id)
      .populate("user", "username email profilePicture");

    if (!pin) {
      return res.status(404).json({ message: "Pin not found" });
    }

    res.status(200).json(pin);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🍱 BIG LUNCHBOX: get full pin + likes + comments
export const getFullPin = async (req, res) => {
  try {
    const pinDoc = await Pin.findById(req.params.id)
      .populate("user", "_id username profilePicture")
      .lean();

    if (!pinDoc) {
      return res.status(404).json({ message: "Pin not found" });
    }

    // Likes
    const likes = await Like.find({ pin: pinDoc._id })
      .populate("user", "_id username profilePicture")
      .lean();

    const likesUsers = likes.map((l) => l.user);
    const likesCount = likesUsers.length;

    // Comments
    const commentsCount = pinDoc.commentsCount || 0;

    // FINAL BIG OBJECT
    const fullPin = {
      ...pinDoc,
      likesCount,
      likesUsers,
      commentsCount,
    };

    res.status(200).json(fullPin);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// 🗑 Update pin
export const updatePin = async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.id);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    if (pin.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const updatedPin = await Pin.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    res.status(200).json(updatedPin);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🗑 Delete pin
export const deletePin = async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.id);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    if (pin.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await pin.deleteOne();
    res.status(200).json({ message: "Pin deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ⬇ Download pin media
export const downloadPinMedia = async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.pinId);
    if (!pin) return res.status(404).json({ message: "Pin not found" });

    const response = await axios.get(pin.mediaUrl, { responseType: "stream" });
    const contentType = pin.mediaType === "video" ? "video/mp4" : "image/jpeg";
    const filename = `pin-${pin._id}.${
      pin.mediaType === "video" ? "mp4" : "jpg"
    }`;

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    response.data.pipe(res);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
