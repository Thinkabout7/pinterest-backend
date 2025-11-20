//searchRoutes.js
import express from "express";
import Pin from "../models/Pin.js";
import User from "../models/User.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res
        .status(400)
        .json({ message: "Please provide a search query (?q=...)" });
    }

    // LEVEL-1 SEARCH  
    // Search title + description + category + tags
    const pinResults = await Pin.find({
      $or: [
        { title: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { category: { $regex: query, $options: "i" } },
        { tags: { $regex: query, $options: "i" } },
      ],
    }).populate("user", "username profilePicture");

    // Search users
    const userResults = await User.find({
      username: { $regex: query, $options: "i" },
    }).select("username profilePicture email");

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
