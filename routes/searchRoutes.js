// routes/searchRoutes.js
import express from "express";
import Pin from "../models/Pin.js";
import User from "../models/User.js";

const router = express.Router();

// 🔍 Search pins and users
router.get("/", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ message: "Please provide a search query (?q=...)" });
    }

    // Case-insensitive regex search
    const pinResults = await Pin.find({
      title: { $regex: query, $options: "i" },
    }).populate("user", "username avatar");

    const userResults = await User.find({
      username: { $regex: query, $options: "i" },
    }).select("username avatar email");

    res.status(200).json({
      query,
      pins: pinResults,
      users: userResults,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
