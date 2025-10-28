// config/cloudinary.js
import dotenv from "dotenv";
dotenv.config(); // make sure .env is loaded even if this runs alone

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

console.log("✅ Cloudinary configured with:", cloudinary.config().cloud_name);

export default cloudinary;

