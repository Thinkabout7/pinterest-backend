import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

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
      return res.status(400).json({ message: "Email and password required" });
    }

    password = String(password);

    const user = await User.findOne({ email });
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
      return res.status(400).json({ message: "Invalid email or password" });
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
    res.status(200).json({
      message: "Protected route accessed successfully",
      user: req.user,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;