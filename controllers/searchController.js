// controllers/searchController.js
import Pin from "../models/Pin.js";
import User from "../models/User.js";
import Board from "../models/Board.js";
import {
  extractKeywords,
  generateVariants,
  getRankedSuggestions,
} from "../utils/autocomplete.js";

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

    const q = query.trim().toLowerCase();
    const baseTerms = [q];
    if (q.endsWith("es")) baseTerms.push(q.slice(0, -2));
    if (q.endsWith("s")) baseTerms.push(q.slice(0, -1));
    else baseTerms.push(`${q}s`);
    const searchTerms = Array.from(new Set(baseTerms.filter(Boolean)));

    const sanitizeText = (val, maxLen = 140) => {
      if (typeof val !== "string") return "";
      const collapsed = val.replace(/\s+/g, " ").trim();
      if (!collapsed) return "";
      const lower = collapsed.toLowerCase();
      // Drop obvious debug/JSON-ish payloads
      if (lower.includes("bounding box")) return "";
      if (/[\{\}\[\]]/.test(collapsed) && collapsed.length > 80) return "";
      return collapsed.length > maxLen
        ? `${collapsed.slice(0, maxLen)}…`
        : collapsed;
    };

    const buildOrQueries = (fields, terms) =>
      fields.flatMap((field) =>
        terms.map((term) => ({ [field]: { $regex: term, $options: "i" } }))
      );

    const vehicleKeywords = [
      "car",
      "cars",
      "vehicle",
      "vehicles",
      "auto",
      "automotive",
      "truck",
      "trucks",
      "jeep",
      "jeeps",
      "suv",
      "suvs",
    ];
    const queryHasVehicleTerm = vehicleKeywords.some((v) =>
      searchTerms.includes(v)
    );

    const results = { pins: [], users: [], boards: [] };
    let rankedSuggestions = [];

    // ---- 1) PIN SEARCH (includes videos filter) ----
    if (["all", "pins", "videos"].includes(type)) {
      const escapedTerms = searchTerms.map((term) =>
        term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      );
      const pattern = escapedTerms.join("|");
      const regex = new RegExp(`\\b(${pattern})\\b`, "i");

      const pinsRaw = await Pin.find({
        $or: [
          { title: regex },
          { description: regex },
          { category: regex },
          { tags: regex },
        ],
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

      let sortedPins = scored.map((s) => s.pin);

      if (queryHasVehicleTerm) {
        const vehicleRegexes = vehicleKeywords.map(
          (v) => new RegExp(`\\b${v}\\b`, "i")
        );
        const withVehicleTag = sortedPins.filter((pin) =>
          (pin.tags || []).some((t) =>
            vehicleRegexes.some((rx) => rx.test(String(t)))
          )
        );
        if (withVehicleTag.length > 0) {
          sortedPins = withVehicleTag;
        }
      }

      const keywords = new Set();

      sortedPins.forEach((pin) => {
        const base = extractKeywords(pin);
        base.forEach((kw) => {
          const variants = generateVariants(kw);
          variants.forEach((v) => keywords.add(v));
        });
      });

      const allVariants = Array.from(keywords);
      rankedSuggestions = getRankedSuggestions(allVariants, query);

      results.pins = sortedPins.map((pin) => {
        const obj = pin.toObject();

        const titleClean = sanitizeText(obj.title);
        const tagList = (obj.tags || []).map((t) => sanitizeText(t));
        const qLower = q.toLowerCase();

        let suggestion = "";

        // 1. Title match
        if (
          titleClean &&
          titleClean.toLowerCase().includes(qLower) &&
          titleClean.split(" ").length <= 4
        ) {
          suggestion = titleClean;
        }

        // 2. Tag match
        if (!suggestion) {
          const match = tagList.find(
            (tag) =>
              tag &&
              tag.toLowerCase().includes(qLower) &&
              tag.split(" ").length <= 3
          );
          if (match) suggestion = match;
        }

        // 3. No valid suggestion
        if (!suggestion) suggestion = null;

        return {
          ...obj,
          descriptionSnippet: sanitizeText(obj.description),
          suggestionText: suggestion,
        };
      });
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
      suggestions: rankedSuggestions,
    });
  } catch (err) {
    console.error("Search Error:", err);
    res.status(500).json({ message: err.message });
  }
};
