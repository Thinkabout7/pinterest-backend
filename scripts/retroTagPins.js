// scripts/retroTagPins.js
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import Pin from "../models/Pin.js";
import { generateImageTags } from "../helpers/geminiImageTags.js";

const SKIP_PIN_IDS = new Set([
  "6911eeb946f408c0ec3c56df",
  "6911eee046f408c0ec3c56e4",
  "6911ef4b46f408c0ec3c56e9",
  "6911efab46f408c0ec3c56ee",
  "6916b181eaf73dad0e0c784f",
  "691b36b2f7bc5a5725e7a17c",
  "691cb8995f3229fd8d187708",
  "691ceaa218a567b7813085db",
  "692360ddacccf53d71b4fe82",
  "692360f9acccf53d71b4fe91",
  "69242d1b116ec3a34f7e73ca",
  "69243051116ec3a34f7e73ef",
  "69244391b120b78be7ab964f",
  "692443b9b120b78be7ab965f",
  "692444e3b120b78be7ab966f",
  "692445ceb120b78be7ab967f",
  "69258a21bfaf281a261fca2d",
  "6926921f85532d9a2e3f42a5",
  "6926925c85532d9a2e3f42b5",
  "692837479b228fb14d82a947",
  "69283f4c9b228fb14d82ac2f",
  "69283f929b228fb14d82ac4e",
  "69283f9d9b228fb14d82ac62",
  "6928f9db7f585ecd6de96d0b",
  "6928fa347f585ecd6de96d26",
  "6928fa477f585ecd6de96d30",
  "6928fa947f585ecd6de96d57",
  "6928faa97f585ecd6de96d61",
  "6928fabc7f585ecd6de96d6b",
  "6928f9237f585ecd6de96cd1",
  "6928f9397f585ecd6de96cdb",
  "6928400e9b228fb14d82adac",
  "6928404d9b228fb14d82adb4",
  "6928eff07f585ecd6de96b0b",
  "6928f1f57f585ecd6de96b7f",
  "6928f77b7f585ecd6de96c57",
  "6928f79f7f585ecd6de96c61",
  "6928f8157f585ecd6de96c82",
  "6928f9007f585ecd6de96cb7",
  "6928f90f7f585ecd6de96cc1",
  "6928face7f585ecd6de96d75",
  "6928fbc37f585ecd6de96d8e",
  "6928fc187f585ecd6de96da2",
  "6928fc327f585ecd6de96db3",
  "6928fc417f585ecd6de96dbd",
  "6928fc687f585ecd6de96dc7",
  "6928fc817f585ecd6de96dd7",
  "6928fca47f585ecd6de96de1",
  "6928fcc37f585ecd6de96df1",
  "6928fcd97f585ecd6de96dfb",
  "6928fcff7f585ecd6de96e11",
  "6928fd267f585ecd6de96e21",
  "6928fd477f585ecd6de96e31",
  "6928fd687f585ecd6de96e41",
  "6928fd9e7f585ecd6de96e55",
  "6928fed17f585ecd6de96ecd",
  "6928f9ba7f585ecd6de96cf1",
  "6928f9c97f585ecd6de96d01",
  "6928fd807f585ecd6de96e4b",
  "6928fdc67f585ecd6de96e65",
  "6928fde67f585ecd6de96e75",
  "6928fdff7f585ecd6de96e85",
  "6928fe237f585ecd6de96e8f",
  "6928fe367f585ecd6de96e99",
  "6928fe4f7f585ecd6de96ea3",
  "6928fe697f585ecd6de96ead",
  "6928feaa7f585ecd6de96ebd",
  "693420e9a5fecceed8771fda",
  "693420f6a5fecceed8771fea",
  "6934210ca5fecceed8771ffa",
  "6934211ca5fecceed877200a",
  "69342130a5fecceed877201a",
  "693428dfa5fecceed87722ed",
  "69342901a5fecceed87722fd",
  "6934290ea5fecceed877230d",
  "6934291da5fecceed877231d",
  "6934292aa5fecceed877232d",
  "692d6b804e7826113b948847",
  "69341eaba5fecceed8771eb3",
  "69341ec7a5fecceed8771ec3",
  "69341ef0a5fecceed8771ed3",
  "69341f06a5fecceed8771ee3",
  "6938850fd89713b542895940",
]);

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

  let retagCount = 0;
  let skipCount = 0;

  for (const pin of pins) {
    if (SKIP_PIN_IDS.has(String(pin._id))) {
      console.log(`Skipping ignored pin: ${pin._id}`);
      skipCount++;
      continue;
    }

    const isImage = pin.mediaType === "image";
    const isVideo = pin.mediaType === "video";

    if (!isImage && !isVideo) {
      console.log(`Skipping unsupported type (${pin.mediaType}): ${pin._id}`);
      continue;
    }

    // Skip pins that were already retagged with new tags
    if (pin.taggedVersion === "new") {
      console.log(`\u2714 Already NEW tagged \u2192 skipping: ${pin._id}`);
      skipCount++;
      continue;
    }

    console.log(`\n\u26a0 Retagging weak tags for pin: ${pin._id}`);
    console.log(`   Title: ${pin.title || "No title"}`);
    console.log(`   URL: ${pin.mediaUrl}`);

    try {
      const newTags = await generateImageTags(pin.mediaUrl);

      if (newTags.length === 0) {
        console.log("   No tags returned by Gemini");
        continue;
      }

      pin.tags = newTags;
      pin.taggedVersion = "new";   // mark as freshly retagged
      await pin.save();

      console.log(`   Tags saved [${newTags.length}]: ${newTags.join(", ")}`);
      console.log(`Updated tags for pin ${pin._id}`);
      retagCount++;
    } catch (err) {
      console.error(`   Failed for ${pin._id}:`, err.message);
    }

    // Be nice to Gemini (free tier safe)
    await new Promise((r) => setTimeout(r, 1800));
  }

  console.log("\n=== RETRO TAGGING SUMMARY ===");
  console.log(`Retagged: ${retagCount}`);
  console.log(`Skipped strong pins: ${skipCount}`);
  console.log("DONE!");
  process.exit(0);
}

retroTagPins();
