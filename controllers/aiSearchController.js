// controllers/aiSearchController.js
import Pin from "../models/Pin.js";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🧠 AI Visual + Text Search
export const aiSearch = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ message: "Missing query (?q=...)" });
    }

    // 1. Load all pins
    const pins = await Pin.find();

    // 2. Score each pin with AI
    const scoredResults = [];

    for (const pin of pins) {
      const response = await client.responses.create({
        model: "gpt-4o-mini",
        input: [
          {
            role: "user",
            content: [
              { type: "text", text: `Rate how well this image matches the search: "${query}". Score 0-100 only.` },
              pin.mediaUrl
                ? {
                    type: "input_image",
                    image_url: pin.mediaUrl,
                  }
                : null,
            ].filter(Boolean),
          },
        ],
      });

      // Score returned as text e.g. "78"
      let scoreText = response.output_text.trim();
      let score = parseInt(scoreText);

      if (isNaN(score)) score = 0;

      scoredResults.push({
        ...pin.toObject(),
        aiScore: score,
      });
    }

    // 3. Sort descending
    scoredResults.sort((a, b) => b.aiScore - a.aiScore);

    // 4. Return all (full ranked list)
    res.status(200).json({
      query,
      count: scoredResults.length,
      results: scoredResults,
    });
  } catch (err) {
    console.error("AI Search Error:", err);
    res.status(500).json({ error: "AI search failed", details: err.message });
  }
};
