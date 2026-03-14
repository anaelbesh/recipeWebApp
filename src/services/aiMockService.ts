/**
 * AI Mock Service
 *
 * When LLM_MOCK_MODE is active, AI endpoints return deterministic, zero-cost
 * responses instead of calling Gemini.  This prevents unexpected API charges
 * during development and makes tests fast and reproducible.
 *
 * LLM_MOCK_MODE values:
 *   always       – always mock (CI, demos, offline development)
 *   development  – mock when NODE_ENV === 'development'
 *   test         – mock when NODE_ENV === 'test'
 *   never        – never mock (default / production)
 */

// ── Mock switch ───────────────────────────────────────────────────────────────

/**
 * Returns true when the LLM should be bypassed.
 * Read lazily (at call time) so tests can set process.env before the first request.
 */
export function isMockEnabled(): boolean {
  const mode = (process.env.LLM_MOCK_MODE ?? 'never').toLowerCase();
  if (mode === 'always') return true;
  if (mode === 'development') return process.env.NODE_ENV === 'development';
  if (mode === 'test') return process.env.NODE_ENV === 'test';
  return false;
}

// ── Parse mock ────────────────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  'Pizza', 'Pasta', 'Burger', 'Fish', 'Salad',
  'Chicken', 'Meat', 'Grill', 'Spreads', 'Other',
] as const;

export interface MockParseFilters {
  categoriesInclude: string[];
  kosherType: string | null;
  cookingMethod: string | null;
  keywordsInclude: string[];
  keywordsExclude: string[];
  maxMinutes: number | null;
}

export interface MockParseResult {
  normalizedQuery: string;
  filters: MockParseFilters;
  warnings: string[];
  confidence: number;
}

/**
 * Deterministic parse — pure string matching, no LLM call, no cost.
 * Input is untrusted user text; we only pattern-match, never eval.
 */
export function mockParse(
  query: string,
  _locale: string,
  _maxResults: number,
): MockParseResult {
  const q = query.toLowerCase();

  const categoriesInclude: string[] = VALID_CATEGORIES.filter((cat) =>
    q.includes(cat.toLowerCase()),
  );

  let kosherType: string | null = null;
  if (q.includes('dairy') || q.includes('milk') || q.includes('cheese')) kosherType = 'Dairy';
  else if (q.includes(' meat') || q.includes('beef') || q.includes('lamb')) kosherType = 'Meat';
  else if (q.includes('vegan') || q.includes('parve')) kosherType = 'Parve';
  // Special case: 'chicken' is Meat in kosher context
  if (kosherType === null && (q.includes('chicken') || q.includes('turkey'))) kosherType = 'Meat';

  let cookingMethod: string | null = null;
  if (q.includes('grill') || q.includes('bbq') || q.includes('barbecue')) cookingMethod = 'Grill';
  else if (q.includes('oven') || q.includes('bak') || q.includes('roast')) cookingMethod = 'Oven';
  else if (q.includes(' pan ') || q.includes('fry') || q.includes('saut')) cookingMethod = 'Pan';
  else if (q.includes('no cook') || q.includes('raw ')) cookingMethod = 'NoCook';
  else if (q.includes('boil') || q.includes('steam')) cookingMethod = 'Boil';

  const minutesMatch = q.match(/under\s+(\d+)\s*min/);
  const maxMinutes = minutesMatch ? parseInt(minutesMatch[1], 10) : null;

  const keywordsExclude: string[] = (q.match(/\bno\s+(\w+)/g) ?? []).map((m) =>
    m.replace(/^no\s+/, ''),
  );

  const stopWords = new Set([
    'with', 'that', 'this', 'from', 'into', 'under', 'and', 'the',
    'for', 'want', 'give', 'have', 'some', 'please', 'like', 'make',
  ]);
  const keywordsInclude = q
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w))
    .slice(0, 5);

  const hasSignal =
    categoriesInclude.length > 0 ||
    kosherType !== null ||
    cookingMethod !== null ||
    maxMinutes !== null;

  return {
    normalizedQuery: query.trim(),
    filters: {
      categoriesInclude,
      kosherType,
      cookingMethod,
      keywordsInclude,
      keywordsExclude,
      maxMinutes,
    },
    warnings: [],
    confidence: hasSignal ? 0.85 : 0.5,
  };
}

// ── Chat mock ─────────────────────────────────────────────────────────────────

export interface MockChatSource {
  recipeId: string;
  title: string;
  category: string;
  imageUrl?: string;
  snippet: string;
  score: number;
  reason: 'semantic' | 'keyword-fallback';
}

export interface MockChatResult {
  answer: string;
  sources: MockChatSource[];
  followUpQuestion: string;
}

/**
 * Deterministic chat — no LLM call, no cost.
 * Returns the same output for the same input every time (useful for snapshot tests).
 */
export function mockChat(message: string, _locale: string): MockChatResult {
  const q = message.toLowerCase();

  let answer = '[MOCK] Here are some recipe ideas based on your request!';
  if (q.includes('pasta') || q.includes('spaghetti') || q.includes('penne'))
    answer = '[MOCK] Try our classic pasta recipes with fresh ingredients.';
  else if (q.includes('pizza'))
    answer = '[MOCK] Our pizza recipes are perfect for any occasion!';
  else if (q.includes('burger') || q.includes('hamburger'))
    answer = '[MOCK] Check out our juicy burger recipes!';
  else if (q.includes('salad'))
    answer = '[MOCK] Fresh and healthy salad ideas coming right up!';
  else if (q.includes('chicken'))
    answer = '[MOCK] We have delicious chicken recipes you will love!';
  else if (q.includes('grill') || q.includes('bbq') || q.includes('barbecue'))
    answer = '[MOCK] Fire up the grill with these BBQ recipes!';
  else if (q.includes('fish') || q.includes('salmon') || q.includes('tuna'))
    answer = '[MOCK] Here are some great fish and seafood recipes!';

  return {
    answer,
    sources: [
      {
        recipeId: 'mock_id_1',
        title: 'Mock Recipe 1',
        category: 'Other',
        snippet: 'A delicious mock recipe for development and testing.',
        score: 0.9,
        reason: 'semantic',
      },
      {
        recipeId: 'mock_id_2',
        title: 'Mock Recipe 2',
        category: 'Other',
        snippet: 'Another mock recipe for development and testing.',
        score: 0.7,
        reason: 'keyword-fallback',
      },
    ],
    followUpQuestion: 'Would you like recipes with a specific cooking method?',
  };
}
