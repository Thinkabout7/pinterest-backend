// utils/autocomplete.js

// Stopwords to remove noise
const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "of",
  "in",
  "on",
  "to",
  "for",
  "with",
  "at",
  "is",
  "it",
]);

// Global keyword index (shared across requests)
const GLOBAL_KEYWORDS = new Set();

// Clean a single word
export function cleanWord(str = "") {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "");
}

function addSingleAndPairs(words, set) {
  for (let i = 0; i < words.length; i++) {
    const w1 = words[i];
    if (w1 && !STOPWORDS.has(w1) && w1.length > 1 && w1.length <= 20) {
      set.add(w1);
    }
    const w2 = words[i + 1];
    if (
      w1 &&
      w2 &&
      !STOPWORDS.has(w1) &&
      !STOPWORDS.has(w2)
    ) {
      const phrase = `${w1} ${w2}`;
      if (phrase.length <= 40) set.add(phrase);
    }
  }
}

// Extract usable keywords from a pin
export function extractKeywordsFromPin(pin) {
  const set = new Set();

  // TITLE WORDS + pairs
  if (pin.title) {
    const words = cleanWord(pin.title).split(/\s+/).filter(Boolean);
    addSingleAndPairs(words, set);
  }

  // CATEGORY
  if (pin.category) {
    const cat = cleanWord(pin.category);
    if (cat && !STOPWORDS.has(cat)) set.add(cat);
  }

  // TAGS
  if (Array.isArray(pin.tags)) {
    pin.tags.forEach((tag) => {
      const words = cleanWord(tag).split(/\s+/).filter(Boolean);
      addSingleAndPairs(words, set);
    });
  }

  return Array.from(set);
}

// Add keywords to the global index
export function addKeywordsToIndex(keywords = []) {
  keywords.forEach((kw) => {
    if (kw) GLOBAL_KEYWORDS.add(kw);
  });
  return Array.from(GLOBAL_KEYWORDS);
}

// Build/update the global index from a list of pins
export function buildKeywordIndexFromPins(pins = []) {
  pins.forEach((pin) => {
    const kws = extractKeywordsFromPin(pin);
    addKeywordsToIndex(kws);
  });
  return Array.from(GLOBAL_KEYWORDS);
}

// Get current global keyword index
export function getKeywordIndex() {
  return Array.from(GLOBAL_KEYWORDS);
}

// Build ranked suggestions
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

  // unique + max 7
  const ordered = [...starts, ...contains, ...ends];
  return Array.from(new Set(ordered)).slice(0, 7);
}
