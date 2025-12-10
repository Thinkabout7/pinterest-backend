// backend/utils/autocomplete.js

// --- STOPWORDS so suggestions stay clean ---
const STOPWORDS = new Set([
  "the", "a", "an", "of", "and", "to", "in", "for", "on", "with", "at", "is"
]);

// --- Normalize words ---
function cleanWord(str = "") {
  if (!str) return "";
  return str.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");
}

// --- Split title/category/tags into useful keywords ---
export function extractKeywords(pin) {
  const set = new Set();

  // TITLE (short words only)
  if (pin.title) {
    const words = cleanWord(pin.title).split(/\s+/);
    words.forEach(w => {
      if (w && !STOPWORDS.has(w)) set.add(w);
    });
  }

  // CATEGORY (single keyword)
  if (pin.category) {
    const cat = cleanWord(pin.category);
    if (cat && !STOPWORDS.has(cat)) set.add(cat);
  }

  // TAGS (allowed fully)
  if (Array.isArray(pin.tags)) {
    pin.tags.forEach(tag => {
      const words = cleanWord(tag).split(/\s+/);
      words.forEach(w => {
        if (w && !STOPWORDS.has(w)) set.add(w);
      });
    });
  }

  return Array.from(set);
}

// --- Pinterest-style variants: keyword + suffixes ---
const SUFFIXES = [
  "aesthetic",
  "drawing",
  "ideas",
  "wallpaper",
  "design",
  "background",
  "tutorial",
  "art"
];

export function generateVariants(keyword) {
  const out = new Set();
  const base = keyword.toLowerCase();

  out.add(base); // main keyword shown

  SUFFIXES.forEach(suf => {
    out.add(`${base} ${suf}`);
  });

  return Array.from(out);
}

// --- Ranking system for suggestions (7 max) ---
export function getRankedSuggestions(allKeywords, query) {
  const q = cleanWord(query);
  if (!q) return [];

  const starts = [];
  const contains = [];
  const ends = [];

  for (const kw of allKeywords) {
    if (kw.startsWith(q)) starts.push(kw);
    else if (kw.includes(q)) contains.push(kw);
    else if (kw.endsWith(q)) ends.push(kw);
  }

  const ordered = [...starts, ...contains, ...ends];

  return Array.from(new Set(ordered)).slice(0, 7);
}
