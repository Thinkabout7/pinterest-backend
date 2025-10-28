// middleware/upload.js
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";
import path from "path";

// ---- Storage config ----
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = /^video\//i.test(file.mimetype);
    return {
      folder: isVideo ? "pinterest_clone/videos" : "pinterest_clone/pins",
      resource_type: isVideo ? "video" : "image",
      allowed_formats: isVideo
        ? ["mp4", "mov", "webm"]
        : ["jpg", "jpeg", "png", "webp"],
      transformation: isVideo
        ? [{ width: 720, height: 1280, crop: "limit" }]
        : [{ width: 1200, crop: "limit" }],
    };
  },
});

// ---- File Filter ----
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".mov", ".webm"];
  const allowedMimes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/quicktime",
    "video/webm",
  ];

  if (allowedExts.includes(ext) || allowedMimes.includes(mime)) {
    cb(null, true);
  } else {
    cb(new Error("Only image or video files are allowed!"), false);
  }
};

// ---- Multer Setup ----
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
});

export default upload;
