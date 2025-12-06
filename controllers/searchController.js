// controllers/searchController.js
import Pin from "../models/Pin.js";
import User from "../models/User.js";
import Board from "../models/Board.js";

// 🔍 TEXT + TAG SEARCH + ADVANCED RANKING
export const searchPins = async (req, res) => {
  try {
    const query = req.query.q;
    const type = (req.query.type || "all").toLowerCase();
    if (!query) {
      return res
        .status(400)
        .json({ message: "Please provide a search query (?q=...)" });
    }

    // Block deactivated / deleted logged-in users from searching at all
    if (req.user && (req.user.isDeactivated || req.user.isDeleted)) {
      return res
        .status(403)
        .json({ message: "Account is deactivated. Reactivate to continue." });
    }

    const q = query.toLowerCase();
    const searchTerms = Array.from(
      new Set(
        [
          q,
          q.endsWith("es") ? q.slice(0, -2) : null,
          q.endsWith("s") ? q.slice(0, -1) : null,
        ].filter(Boolean)
      )
    );

    const buildOrQueries = (fields, terms) =>
      fields.flatMap((field) =>
        terms.map((term) => ({ [field]: { $regex: term, $options: "i" } }))
      );

    const results = { pins: [], users: [], boards: [] };

    // ---- 1) PIN SEARCH (includes videos filter) ----
    if (["all", "pins", "videos"].includes(type)) {
      const pinsRaw = await Pin.find({
        $or: buildOrQueries(
          ["title", "description", "category", "tags"],
          searchTerms
        ),
      }).populate({
        path: "user",
        select: "username profilePicture isDeactivated isDeleted",
        match: { isDeactivated: false, isDeleted: false },
      });

      // Hide pins whose owners are deactivated/deleted
      let pins = pinsRaw.filter((p) => p.user);

      if (type === "videos") {
        pins = pins.filter((p) => p.mediaType === "video");
      }

      // ---- 2) SCORE EACH PIN ----
      const scored = pins.map((pin) => {
        let score = 0;

        const title = pin.title?.toLowerCase() || "";
        const desc = pin.description?.toLowerCase() || "";
        const cat = pin.category?.toLowerCase() || "";
        const tags = pin.tags?.map((t) => t.toLowerCase()) || [];

        if (title.includes(q)) score += 50;
        if (title.startsWith(q)) score += 20;
        if (title === q) score += 35;

        if (desc.includes(q)) score += 30;
        if (desc.startsWith(q)) score += 10;

        if (cat.includes(q)) score += 15;
        if (cat === q) score += 20;

        if (tags.includes(q)) score += 40;
        if (tags.some((t) => t.includes(q))) score += 25;

        score += (pin.likesCount || 0) * 3;
        score += (pin.commentsCount || 0) * 2;

        return { pin, score };
      });

      scored.sort((a, b) => b.score - a.score);

      results.pins = scored.map((s) => s.pin);
    }

    // ---- 3) USER / PROFILE SEARCH ----
    if (["all", "profiles"].includes(type)) {
      const users = await User.find({
        $or: buildOrQueries(["username"], searchTerms),
        isDeleted: false,
        isDeactivated: false,
      }).select("_id username profilePicture");

      results.users = users;
    }

    // ---- 4) BOARD SEARCH ----
    if (["all", "boards"].includes(type)) {
      const boardsRaw = await Board.find({
        $or: buildOrQueries(["name", "description"], searchTerms),
      })
        .populate({
          path: "user",
          select: "username isDeactivated isDeleted",
          match: { isDeactivated: false, isDeleted: false },
        })
        .populate({
          path: "pins",
          select: "mediaUrl mediaType",
        });

      const boards = boardsRaw
        .filter((b) => b.user)
        .map((b) => ({
          _id: b._id,
          name: b.name,
          coverImage: b.coverImage || b.pins?.[0]?.mediaUrl || "",
          pinsCount: b.pins?.length || 0,
          owner: b.user.username,
        }));

      results.boards = boards;
    }

    // ---- 5) FINAL RESPONSE ----
    res.status(200).json({
      query,
      type,
      ...results,
    });
  } catch (err) {
    console.error("Search Error:", err);
    res.status(500).json({ message: err.message });
  }
};
