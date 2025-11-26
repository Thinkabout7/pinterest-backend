
// routes/followRoutes.js
import express from "express";
import User from "../models/User.js";
import protect from "../middleware/authMiddleware.js";
import Notification from "../models/Notification.js";
import { checkFollowStatus } from "../controllers/followController.js";

const router = express.Router();

// 👣 Follow a user
router.post("/:id/follow", protect, async (req, res) => {
  try {
    const targetId = req.params.id;
    const myId = req.user._id;

    if (myId.toString() === targetId)
      return res.status(400).json({ message: "You cannot follow yourself" });

    const me = await User.findById(myId);
    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: "User not found" });

    if (me.following.includes(targetId))
      return res.status(400).json({ message: "Already following this user" });

    me.following.push(targetId);
    target.followers.push(myId);
    await me.save();
    await target.save();

    // 🔔 Notify followed user
    await Notification.create({
      recipient: target._id,
      sender: me._id,
      type: "follow",
      message: `${me.username} started following you.`,
    });

    res.status(200).json({ message: `You followed ${target.username}` });
  } catch (err) {
    console.error("Follow error:", err);
    res.status(500).json({ message: err.message });
  }
});

// 🚫 Unfollow
router.post("/:id/unfollow", protect, async (req, res) => {
  try {
    const targetId = req.params.id;
    const myId = req.user._id;

    const me = await User.findById(myId);
    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: "User not found" });

    me.following = me.following.filter((u) => u.toString() !== targetId);
    target.followers = target.followers.filter(
      (u) => u.toString() !== myId.toString()
    );

    await me.save();
    await target.save();

    res.status(200).json({ message: `You unfollowed ${target.username}` });
  } catch (err) {
    console.error("Unfollow error:", err);
    res.status(500).json({ message: err.message });
  }
});

// 👀 Followers list
router.get("/:id/followers", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate(
      "followers",
      "username email profilePicture"
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user.followers);
  } catch (err) {
    console.error("Get followers error:", err);
    res.status(500).json({ message: err.message });
  }
});

// 👥 Following list
router.get("/:id/following", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate(
      "following",
      "username email profilePicture"
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user.following);
  } catch (err) {
    console.error("Get following error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Check follow status for notification button
router.get("/check/:id", protect, checkFollowStatus);

export default router;
