// routes/authRoutes.js

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

/* ========================================
   REGISTER
======================================== */
router.post("/register", async (req, res) => {
  try {
    let { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Duplicate EMAIL
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Duplicate USERNAME
    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res.status(400).json({ message: "Username already taken" });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
    });

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

    // Mongo duplicate fallback
    if (err.code === 11000) {
      if (err.keyPattern?.username) {
        return res.status(400).json({ message: "Username already taken" });
      }
      if (err.keyPattern?.email) {
        return res.status(400).json({ message: "Email already registered" });
      }
    }

    res.status(500).json({ message: err.message });
  }
});


/* ========================================
   LOGIN
======================================== */
router.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email/Username and password required" });
    }

    const user = await User.findOne({
      $or: [{ email }, { username: email }],
    });

    if (!user || user.isDeleted) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(String(password), user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Auto-reactivate
    if (user.isDeactivated) {
      user.isDeactivated = false;
      await user.save();
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


/* ========================================
   PROFILE
======================================== */
router.get("/profile", protect, async (req, res) => {
  try {
    res.status(200).json({
      message: "Protected route accessed successfully",
      user: req.user,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


/* ========================================
   CHANGE USERNAME
======================================== */
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

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { username: newUsername },
      { new: true }
    );

    res.json({ message: "Username updated", user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


/* ========================================
   CHANGE PASSWORD
======================================== */
router.put("/change-password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current and new password required" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: "New password must be different from current password",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user || user.isDeleted) {
      return res.status(404).json({ message: "User not found" });
    }

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


/* ========================================
   DEACTIVATE ACCOUNT (TEMPORARY)
======================================== */
router.put("/deactivate", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user || user.isDeleted) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isDeactivated) {
      return res.status(400).json({ message: "Account already deactivated" });
    }

    user.isDeactivated = true;
    await user.save();

    res.json({ message: "Account deactivated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


/* ========================================
   REACTIVATE ACCOUNT
======================================== */
router.put("/reactivate", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user || user.isDeleted) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isDeactivated) {
      return res.status(400).json({ message: "Account is not deactivated" });
    }

    user.isDeactivated = false;
    await user.save();

    res.json({ message: "Account reactivated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


/* ========================================
   DELETE ACCOUNT (PERMANENT)
======================================== */
router.delete("/delete-account", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user || user.isDeleted) {
      return res.status(404).json({ message: "User not found" });
    }

    // Soft delete + free username/email
    user.isDeleted = true;
    user.isDeactivated = true;

    const id = user._id.toString();
    user.username = `deleted_user_${id}`;
    user.email = `deleted_${id}@deleted.local`;
    user.password = await bcrypt.hash(Math.random().toString(36), 10);

    await user.save();

    res.json({ message: "Account deleted permanently" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
