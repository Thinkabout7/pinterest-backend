//tavilySearchController.js

import Pin from "../models/Pin.js";
import axios from "axios";

export const tavilySearch = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ message: "Missing ?q=" });
    }

    const TAVILY_KEY = process.env.TAVILY_API_KEY;
    if (!TAVILY_KEY) {
      return res.status(500).json({ message: "Missing TAVILY_API_KEY" });
    }

    // 1️⃣ Ask Tavily for semantic keywords
    const tavilyRes = await axios.post(
      "https://api.tavily.com/search",
      {
        api_key: TAVILY_KEY,
        query,
        max_tokens: 10
      },
      {
        headers: { "Content-Type": "application/json" }
      }
    );

    const semanticKeywords = tavilyRes.data?.query_context?.keywords || [];
    const keywordString = semanticKeywords.join(" ");

    // 2️⃣ Search pins using (title + description + category)
    const pins = await Pin.find({
      $or: [
        { title: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { category: { $regex: query, $options: "i" } },

        // semantic keyword search
        { title: { $regex: keywordString, $options: "i" } },
        { description: { $regex: keywordString, $options: "i" } },
        { category: { $regex: keywordString, $options: "i" } }
      ]
    });

    res.status(200).json({
      query,
      keywordsUsed: semanticKeywords,
      count: pins.length,
      results: pins,
    });

  } catch (err) {
    console.error("Tavily Search Error:", err.response?.data || err.message);

    res.status(500).json({
      error: "Tavily search failed",
      details: err.response?.data || err.message,
    });
  }
};
