// scripts/retroTagPins.js
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import Pin from "../models/Pin.js";
import { generateImageTags } from "../helpers/geminiImageTags.js";

console.log("Starting retro-tagging...");

// --- CONNECT TO DB ---
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

// --- MAIN RETRO-TAGGING ---
async function retroTagPins() {
  await connectDB();

  const pins = await Pin.find({ mediaUrl: { $exists: true } });

  console.log(`Found ${pins.length} pins to scan...\n`);

  for (const pin of pins) {
    const isImage = pin.mediaType === "image";
    const isVideo = pin.mediaType === "video";

    // Skip anything that's not image or video
    if (!isImage && !isVideo) {
      console.log(`Skipping unsupported type (${pin.mediaType}): ${pin._id}`);
      continue;
    }

    // Skip if already has AI tags
    if (pin.tags && pin.tags.length > 0) {
      console.log(`Already tagged (${isVideo ? "VIDEO" : "IMAGE"}): ${pin._id} – ${pin.title || "Untitled"}`);
      continue;
    }

    console.log(`\nTagging ${isVideo ? "VIDEO" : "IMAGE"} pin: ${pin._id}`);
    console.log(`   Title: ${pin.title || "No title"}`);
    console.log(`   URL: ${pin.mediaUrl}`);

    try {
      const tags = await generateImageTags(pin.mediaUrl);

      if (tags.length === 0) {
        console.log("   No tags returned by Gemini");
        continue;
      }

      pin.tags = tags;
      await pin.save();

      console.log(`   Tags saved [${tags.length}]: ${tags.join(", ")}`);
    } catch (err) {
      console.error(`   Failed for ${pin._id}:`, err.message);
    }

    // Be nice to Gemini (free tier safe)
    await new Promise((r) => setTimeout(r, 1800));
  }

  console.log("\nDONE! All images and videos processed with AI tags!");
  process.exit(0);
}

retroTagPins();