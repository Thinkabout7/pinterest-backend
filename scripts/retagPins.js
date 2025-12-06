// Batch retag pins using Gemini Vision. Not auto-run; invoke with `node scripts/retagPins.js`.
import dotenv from "dotenv";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";
import connectDB from "../config/db.js";
import Pin from "../models/Pin.js";

dotenv.config();

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
// Throttle: 1 pin at a time with delay to respect free-tier limits
const BATCH_SIZE = 1;
const DELAY_MS = Number(process.env.RETAG_DELAY_MS || 25000); // default 25s; override via RETAG_DELAY_MS

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

const prompt = `You are a concise image tagger.
Return a JSON array of 3-5 specific tags describing clear objects or main subjects.
- Use single words or short phrases.
- Only include "car"/"vehicle"/"truck" if a vehicle is clearly visible.
- Avoid vague vibe words (aesthetic, mood) and food unless food is the main subject.
- No explanations, just the JSON array.`;

const fetchImageBase64 = async (url) => {
  const resp = await axios.get(url, { responseType: "arraybuffer" });
  const mime = resp.headers["content-type"] || "image/jpeg";
  const b64 = Buffer.from(resp.data, "binary").toString("base64");
  return { inlineData: { data: b64, mimeType: mime } };
};

const tagPin = async (pin) => {
  try {
    const imagePart = await fetchImageBase64(pin.mediaUrl);
    const result = await model.generateContent([prompt, imagePart]);
    const raw = result.response.text().trim();

    const cleanToArray = (text) => {
      // Strip common Markdown fences like ```json ... ```
      const fenceStripped = text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      // Try to parse the first JSON array present
      const start = fenceStripped.indexOf("[");
      const end = fenceStripped.lastIndexOf("]");
      if (start !== -1 && end !== -1 && end > start) {
        const slice = fenceStripped.slice(start, end + 1);
        try {
          const parsed = JSON.parse(slice);
          if (Array.isArray(parsed)) return parsed;
        } catch (_) {
          // fall through to comma split
        }
      }

      // Fallback: split on commas
      return fenceStripped
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    };

    const tags = cleanToArray(raw);

    if (!Array.isArray(tags) || tags.length === 0) {
      throw new Error("No tags returned");
    }

    // overwrite tags; adjust if you prefer to append/backup
    pin.tags = tags.slice(0, 6);
    await pin.save();
    console.log(`Updated tags for pin ${pin._id}`);
  } catch (err) {
    console.error(`Failed to tag pin ${pin._id}:`, err.message);
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  if (!process.env.GOOGLE_API_KEY) {
    console.error("Missing GOOGLE_API_KEY");
    process.exit(1);
  }

  await connectDB();

  const targetIds =
    process.env.RETAG_IDS?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) || [];

  const query = targetIds.length ? { _id: { $in: targetIds } } : {};

  const total = await Pin.countDocuments(query);
  console.log(
    `Found ${total} pin${total === 1 ? "" : "s"} to retag${
      targetIds.length ? " (filtered by RETAG_IDS)" : ""
    }`
  );

  for (let skip = 0; skip < total; skip += BATCH_SIZE) {
    const batch = await Pin.find(query).skip(skip).limit(BATCH_SIZE);
    for (const pin of batch) {
      await tagPin(pin);
      if (DELAY_MS > 0) {
        await sleep(DELAY_MS);
      }
    }
  }

  console.log("Retagging complete");
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
