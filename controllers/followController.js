import User from "../models/User.js";
import Notification from "../models/Notification.js";

/* ----------------------------------------------------------
   FOLLOW USER
----------------------------------------------------------- */
export const followUser = async (req, res) => {
  try {
    const followerId = req.user._id;
    const targetId = req.params.id;

    if (followerId.toString() === targetId) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const follower = await User.findById(followerId);
    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: "User not found" });

    const alreadyFollowing = follower.following.some(
      (u) => u.toString() === targetId
    );

    if (alreadyFollowing) {
      return res.status(400).json({ message: "Already following this user" });
    }

    follower.following.push(targetId);
    target.followers.push(followerId);

    await follower.save();
    await target.save();

    await Notification.create({
      recipient: targetId,
      sender: followerId,
      type: "follow",
      message: `${follower.username} started following you.`,
    });

    return res.status(200).json({
      message: "Followed successfully",
      followerId,
      targetId,
    });
  } catch (err) {
    console.error("FOLLOW ERROR:", err);
    return res.status(500).json({ message: err.message });
  }
};

/* ----------------------------------------------------------
   UNFOLLOW USER
----------------------------------------------------------- */
export const unfollowUser = async (req, res) => {
  try {
    const followerId = req.user._id;
    const targetId = req.params.id;

    const follower = await User.findById(followerId);
    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: "User not found" });

    follower.following = follower.following.filter(
      (u) => u.toString() !== targetId
    );
    target.followers = target.followers.filter(
      (u) => u.toString() !== followerId
    );

    await follower.save();
    await target.save();

    return res.status(200).json({
      message: "Unfollowed successfully",
      followerId,
      targetId,
    });
  } catch (err) {
    console.error("UNFOLLOW ERROR:", err);
    return res.status(500).json({ message: err.message });
  }
};

/* ----------------------------------------------------------
   GET FOLLOWERS LIST
----------------------------------------------------------- */
export const getFollowers = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate(
      "followers",
      "username email profilePicture"
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json(user.followers);
  } catch (err) {
    console.error("GET FOLLOWERS ERROR:", err);
    return res.status(500).json({ message: err.message });
  }
};

/* ----------------------------------------------------------
   GET FOLLOWING LIST
----------------------------------------------------------- */
export const getFollowing = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate(
      "following",
      "username email profilePicture"
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json(user.following);
  } catch (err) {
    console.error("GET FOLLOWING ERROR:", err);
    return res.status(500).json({ message: err.message });
  }
};

/* ----------------------------------------------------------
   CHECK FOLLOW STATUS (⭐ REQUIRED FOR FOLLOW BACK BUTTON)
----------------------------------------------------------- */
export const checkFollowStatus = async (req, res) => {
  try {
    const myId = req.user._id;
    const targetId = req.params.id;

    const me = await User.findById(myId);
    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: "User not found" });

    const isFollowing = me.following.some(
      (u) => u.toString() === targetId.toString()
    );

    const isFollowedByTarget = target.following.some(
      (u) => u.toString() === myId.toString()
    );

    return res.json({
      isFollowing,
      isFollowedBySender: isFollowedByTarget,
    });
  } catch (err) {
    console.error("CHECK FOLLOW STATUS ERROR:", err);
    return res.status(500).json({ message: err.message });
  }
};
