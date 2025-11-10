// server.js
import dotenv from "dotenv";
dotenv.config();

console.log("✅ Cloudinary ENV check:");
console.log("CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME);
console.log("API_KEY:", process.env.CLOUDINARY_API_KEY);

// Core imports
import express from "express";
import connectDB from "./config/db.js";
import cors from "cors";
// Initialize Express
const app = express();

// Middleware to parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
// Connect MongoDB
connectDB();

// Route imports
import authRoutes from "./routes/authRoutes.js";
import pinRoutes from "./routes/pinRoutes.js";
import commentRoutes from "./routes/commentRoutes.js";
import likeRoutes from "./routes/likeRoutes.js";
import boardRoutes from "./routes/boardRoutes.js";
import followRoutes from "./routes/followRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import feedRoutes from "./routes/feedRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import userRoutes from  "./routes/userRoute.js";
import SavedPinRoutes from "./routes/SavedPinRoutes.js";
// Route usage
app.use("/api/auth", authRoutes);
app.use("/api/pins", pinRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/likes", likeRoutes);
app.use("/api/boards", boardRoutes);
app.use("/api/users", followRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/users", userRoutes);
app.use("/api/pins", SavedPinRoutes);
app.use("/api/follow", followRoutes);
app.use("/api/users", SavedPinRoutes);
// Root test route
app.get("/", (req, res) => {
  res.send("✅ Pinterest Backend Running...");
});
// Global Error Handler
app.use((err, req, res, next) => {
  console.error("❌ Global error:", err.stack);
  res.status(500).json({
    success: false,
    message: err.message || "Something went wrong!",
  });
});






// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
