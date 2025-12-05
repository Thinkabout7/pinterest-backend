//searchController.js
import Pin from "../models/Pin.js";
import User from "../models/User.js";

// 🔍 TEXT + TAG SEARCH + ADVANCED RANKING
export const searchPins = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res
        .status(400)
        .json({ message: "Please provide a search query (?q=...)" });
    }

    const q = query.toLowerCase();

    // ---- 1) FETCH CANDIDATES (match ANY field) ----
    const pins = await Pin.find({
      $or: [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { category: { $regex: q, $options: "i" } },
        { tags: { $regex: q, $options: "i" } },
      ],
    }).populate("user", "username profilePicture");

    // ---- 2) SCORE EACH PIN ----
    const scored = pins.map(pin => {
      let score = 0;

      const title = pin.title?.toLowerCase() || "";
      const desc = pin.description?.toLowerCase() || "";
      const cat  = pin.category?.toLowerCase() || "";
      const tags = pin.tags?.map(t => t.toLowerCase()) || [];

      // ⭐ TEXT MATCH WEIGHTS
      if (title.includes(q)) score += 50;             // title contains
      if (title.startsWith(q)) score += 20;           // title starts with
      if (title === q) score += 35;                   // exact title match

      if (desc.includes(q)) score += 30;              // description contains
      if (desc.startsWith(q)) score += 10;

      if (cat.includes(q)) score += 15;               // category match
      if (cat === q) score += 20;

      // ⭐ TAG MATCH WEIGHTS
      if (tags.includes(q)) score += 40;              // exact tag match
      if (tags.some(t => t.includes(q))) score += 25; // partial tag match

      // ⭐ POPULARITY BOOST (like Pinterest)
      score += (pin.likesCount || 0) * 3;
      score += (pin.commentsCount || 0) * 2;

      return { pin, score };
    });

    // ---- 3) SORT DESCENDING (Best → Worst) ----
    scored.sort((a, b) => b.score - a.score);

    const sortedPins = scored.map(s => s.pin);

    // ---- 4) USER SEARCH ----
    const users = await User.find({
      username: { $regex: q, $options: "i" },
    }).select("username profilePicture email");

    // ---- 5) FINAL RESPONSE ----
    res.status(200).json({
      query,
      pins: sortedPins,
      users,
    });

  } catch (err) {
    console.error("Search Error:", err);
    res.status(500).json({ message: err.message });
  }
};
