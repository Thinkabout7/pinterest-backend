// server.js
//tweaking dotenv import to fix issues with ES modules
import dotenv from "dotenv";
dotenv.config();

// --- Debug Cloudinary env ---
console.log("✅ Cloudinary ENV check:");
console.log("CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME);
console.log("API_KEY:", process.env.CLOUDINARY_API_KEY);

// --- Core imports ---
import express from "express";
import connectDB from "./config/db.js";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// --- Setup Express ---
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// --- Fix dirname handling ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Serve uploads folder ---
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- Connect MongoDB ---
connectDB();

// --- Route imports ---
import authRoutes from "./routes/authRoutes.js";
import pinRoutes from "./routes/pinRoutes.js";
import likeRoutes from "./routes/likeRoutes.js";
import boardRoutes from "./routes/boardRoutes.js";
import followRoutes from "./routes/followRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import feedRoutes from "./routes/feedRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import userRoutes from "./routes/userRoute.js";
import SavedPinRoutes from "./routes/SavedPinRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import commentRoutes from "./routes/commentRoutes.js";  
// --- Route usage ---
app.use("/api/auth", authRoutes);
app.use("/api/pins", pinRoutes);
app.use("/api/likes", likeRoutes);
app.use("/api/boards", boardRoutes);
app.use("/api/follow", followRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/users", userRoutes);
app.use("/api/saved", SavedPinRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/comments", commentRoutes);
// --- Root test route ---
app.get("/", (req, res) => {
  res.send("✅ Pinterest Backend Running...");
});

// --- Global error handler ---
app.use((err, req, res, next) => {
  console.error("❌ Global error:", err.stack);
  res.status(500).json({
    success: false,
    message: err.message || "Something went wrong!",
  });
});

// --- Start server ---
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);