/**
 * Kurdish Spell Checker Logic
 * Supports Sorani (Arabic script) and Kurmanji (Latin script)
 */

export interface Suggestion {
  word: string;
  distance: number;
}

// Common mistakes mapping for auto-correction
export const COMMON_MISTAKES: Record<string, string> = {
  // Sorani examples
  "سلاو": "سڵاو",
  "سڵاوو": "سڵاو",
  "باشە": "باشە",
  "سپاس": "سوپاس",
  "مال": "ماڵ",
  "گول": "گوڵ",
  "دل": "دڵ",
  "کوردستان": "کوردستان",
  "کوردیی": "کوردی",
  "ئەحمەد": "ئەحمەد",
  "کتێب": "کتێب",
  "دەکەم": "دەکەم",
  "ئەووە": "ئەوە",
  "بۆۆ": "بۆ",
  "چۆۆن": "چۆن",
  "باشیی": "باشی",
  "هەولێر": "هەولێر",
  "سلێمانیی": "سلێمانی",
  "کەرکوک": "کەرکووک",
  "دهۆک": "دهۆک",
  
  // Kurmanji examples
  "silaw": "silav",
  "kurdi": "kurdî",
  "rojbas": "rojbaş",
  "spas": "spas",
};

// A sample dictionary of Kurdish words (Sorani & Kurmanji)
// In a real app, this would be a much larger list or a trie structure.
export const DICTIONARY: string[] = [
  // Sorani
  "سڵاو", "چۆن", "باش", "باشی", "سوپاس", "کتێب", "قەڵەم", "ماڵ", "شار", "وڵات",
  "کوردستان", "کوردی", "زمان", "خوێندن", "زانکۆ", "قوتابخانە", "مامۆستا", "قوتابی",
  "هەولێر", "سلێمانی", "دهۆک", "کەرکووک", "هەڵەبجە", "زاخۆ", "ئاکرێ", "سۆران",
  "نان", "ئاو", "خواردن", "گەشت", "کار", "ژیان", "ئازادی", "ئاشتی", "خۆشەویستی",
  "دڵ", "چاو", "دەست", "سەر", "پێ", "گوێ", "زمان", "ددان", "موو", "پێست",
  "ئەو", "ئەوانە", "ئەمانیش", "هەموو", "هەندێک", "زۆر", "کەم", "باشتر", "خراپتر", "گەورە", "بچووک", "جوان", "ناشرین", "خێرا", "هێواش", "سارد", "گەرم", "دوور", "نزیک",
  "ڕۆژ", "شەو", "بەیانی", "نیوەڕۆ", "ئێوارە", "دوێنێ", "ئەمڕۆ", "بەیانی", "ساڵ", "مانگ", "هەفتە", "کاتژمێر", "خولەک", "چرکە",
  "باوک", "دایک", "برا", "خوشک", "کوڕ", "کچ", "پیاو", "ژن", "منداڵ", "هاوڕێ", "کەس", "خەڵک",

  // Kurmanji
  "silav", "çawa", "baş", "başî", "spas", "pirtûk", "pênûs", "mal", "bajar", "welat",
  "kurdistan", "kurdî", "ziman", "xwendin", "zanîngeh", "dibistan", "mamoste", "xwendevan",
  "hewlêr", "silêmanî", "dihok", "kerkûk", "helebce", "zaxo", "akrê", "soran",
  "nan", "av", "xwarin", "geşt", "kar", "jiyan", "azadî", "aştî", "evîn",
  "dil", "çav", "dest", "ser", "pê", "guh", "ziman", "diran", "por", "çerm",
  "ew", "ev", "wan", "em", "tu", "hûn", "ez", "ew",
  "dikim", "dixwînim", "diçim", "têm", "dibînim", "dibîzim", "dibêjim", "dizanim",
  "roj", "şev", "sibê", "nîvro", "êوارە", "duh", "îro", "sal", "meh", "hefte", "saet",

  // English (Basic list to prevent false positives in mixed text)
  "hello", "how", "good", "thanks", "book", "pen", "home", "city", "country",
  "world", "language", "study", "university", "school", "teacher", "student",
  "work", "life", "freedom", "peace", "love", "heart", "eye", "hand", "head",
  "the", "and", "is", "are", "was", "were", "have", "has", "had", "do", "does",
  "did", "will", "would", "shall", "should", "can", "could", "may", "might",
  "must", "ought", "i", "you", "he", "she", "it", "we", "they", "me", "him",
  "her", "us", "them", "my", "your", "his", "its", "our", "their", "this",
  "that", "these", "those", "what", "which", "who", "whom", "whose", "where",
  "when", "why", "how", "all", "any", "both", "each", "few", "more", "most",
  "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so",
  "than", "too", "very", "s", "t", "can", "will", "just", "don", "should", "now"
];

/**
 * Levenshtein distance algorithm to find the edit distance between two strings
 */
export function getLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Get spelling suggestions for a word
 */
export function getSuggestions(word: string, limit: number = 3): Suggestion[] {
  if (!word) return [];
  
  const suggestions = DICTIONARY.map(dictWord => ({
    word: dictWord,
    distance: getLevenshteinDistance(word.toLowerCase(), dictWord.toLowerCase())
  }))
  .filter(s => s.distance > 0 && s.distance <= 2) // Only close matches
  .sort((a, b) => a.distance - b.distance)
  .slice(0, limit);

  return suggestions;
}

/**
 * Check if a word is correctly spelled
 */
export function isCorrect(word: string): boolean {
  if (!word) return true;
  const cleanWord = word.trim().toLowerCase();
  return DICTIONARY.includes(cleanWord) || !!COMMON_MISTAKES[cleanWord];
}

/**
 * Auto-correct common mistakes
 */
export function autoCorrect(text: string): string {
  const words = text.split(/\s+/);
  const correctedWords = words.map(word => {
    const cleanWord = word.replace(/[.,!?;:]/g, "");
    if (COMMON_MISTAKES[cleanWord]) {
      return word.replace(cleanWord, COMMON_MISTAKES[cleanWord]);
    }
    return word;
  });
  return correctedWords.join(" ");
}
