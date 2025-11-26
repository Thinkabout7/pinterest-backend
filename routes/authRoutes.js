// routes/authRoutes.js

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();
console.log("🔥 LOADED: authRoutes.js");

// ---------------- REGISTER ----------------
router.post("/register", async (req, res) => {
  try {
    console.log("Raw request body:", req.body);
    let { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    password = String(password);

    const existing = await User.findOne({ email });
    console.log("Existing user check:", existing);
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    console.log("🔐 Registering new user:");
    console.log("Plain password received:", password);

    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Hashed password being saved:", hashedPassword);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    console.log("Saved user:", await User.findOne({ email }));

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ---------------- LOGIN ----------------
router.post("/login", async (req, res) => {
  try {
    console.log("Raw request body:", req.body);
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email/Username and password required" });
    }

    password = String(password);

    // 🔥 Allow login with email OR username
    const user = await User.findOne({
      $or: [{ email: email }, { username: email }]
    });

    if (!user) {
      console.log("❌ No user found for:", email);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("✅ Found user:", user.email);
    console.log("Incoming password:", password);
    console.log("Stored hash:", user.password);

    const isMatch = await bcrypt.compare(password, user.password);
    console.log("Password match result:", isMatch);

    if (!isMatch) {
      console.log("❌ Password mismatch for user:", email);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ---------------- PROFILE ----------------
router.get("/profile", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "_id username email profilePicture followers following isDeactivated"
    );
 
    res.json({
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture || null,
        followers: user.followers,
        following: user.following,
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ---------------- CHANGE USERNAME ----------------
router.put("/change-username", protect, async (req, res) => {
  try {
    const { newUsername } = req.body;

    if (!newUsername) {
      return res.status(400).json({ message: "Username required" });
    }

    const exists = await User.findOne({ username: newUsername });
    if (exists) {
      return res.status(400).json({ message: "Username already taken" });
    }

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { username: newUsername },
      { new: true }
    );

    res.json({
      message: "Username updated",
      user: {
        id: updated._id,
        username: updated.username,
        email: updated.email,
        profilePicture: updated.profilePicture || null,
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---------------- CHANGE PASSWORD ----------------
router.put("/change-password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect current password" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---------------- DEACTIVATE ACCOUNT (TEMP) ----------------
router.put("/deactivate", protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isDeactivated: true });

    res.json({ message: "Account deactivated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---------------- REACTIVATE ACCOUNT ----------------
router.put("/reactivate", protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isDeactivated: false });

    res.json({ message: "Account reactivated" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---------------- DELETE ACCOUNT (PERMANENT) ----------------
router.delete("/delete-account", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    user.isDeleted = true;
    user.isDeactivated = true;

    const id = user._id.toString();
    user.username = `deleted_${id}`;
    user.email = `deleted_${id}@deleted.local`;
    user.password = await bcrypt.hash(Math.random().toString(36), 10);

    await user.save();

    res.json({ message: "Account deleted permanently" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
