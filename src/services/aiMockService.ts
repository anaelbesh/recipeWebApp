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

import { RECIPE_CATEGORIES } from '../constants/recipeCategories';

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

  // Match against new categories using flexible matching
  const categoriesInclude: string[] = RECIPE_CATEGORIES.filter((cat) => {
    const catLower = cat.toLowerCase();
    // For complex category names like "Pastries / Baked Goods", match any key word
    const keywords = catLower.split(/[\/\-\s]+/).filter(k => k.length > 2);
    return keywords.some(keyword => q.includes(keyword));
  });

  // Add special mappings for common foods to categories
  if ((q.includes('pasta') || q.includes('spaghetti') || q.includes('penne') || q.includes('lasagna')) &&
      !categoriesInclude.includes('Comfort Food')) {
    categoriesInclude.push('Comfort Food');
  }
  if ((q.includes('burger') || q.includes('hamburger')) &&
      !categoriesInclude.includes('Sandwiches / Wraps')) {
    categoriesInclude.push('Sandwiches / Wraps');
  }
  if ((q.includes('pizza')) &&
      !categoriesInclude.includes('Pizza')) {
    categoriesInclude.push('Pizza');
  }
  if ((q.includes('fish') || q.includes('seafood') || q.includes('salmon') || q.includes('tuna')) &&
      !categoriesInclude.includes('Fish')) {
    categoriesInclude.push('Fish');
  }

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
  
  // Original categories (now mapped to new ones)
  if (q.includes('pasta') || q.includes('spaghetti') || q.includes('penne'))
    answer = '[MOCK] Try our classic meat-based pasta recipes with fresh ingredients.';
  else if (q.includes('pizza'))
    answer = '[MOCK] Our comforting pizza recipes are perfect for any occasion!';
  else if (q.includes('burger') || q.includes('hamburger'))
    answer = '[MOCK] Check out our juicy meat-based sandwich and wrap recipes!';
  else if (q.includes('salad'))
    answer = '[MOCK] Fresh and delicious salad ideas coming right up!';
  else if (q.includes('chicken'))
    answer = '[MOCK] We have delicious meat recipes with poultry you will love!';
  else if (q.includes('grill') || q.includes('bbq') || q.includes('barbecue'))
    answer = '[MOCK] Fire up the grill with these meat comfort food recipes!';
  else if (q.includes('fish') || q.includes('salmon') || q.includes('tuna'))
    answer = '[MOCK] Here are some great parve fish and seafood recipes!';
  
  // New categories
  else if (q.includes('dairy') || q.includes('milk') || q.includes('cheese'))
    answer = '[MOCK] Check out our delicious dairy-based recipes!';
  else if (q.includes('dessert') || q.includes('cake') || q.includes('sweet') || q.includes('chocolate'))
    answer = '[MOCK] Indulge in our wonderful dessert and pastry recipes!';
  else if (q.includes('bread') || q.includes('bak'))
    answer = '[MOCK] Fresh bread and pastry recipes await you!';
  else if (q.includes('breakfast') || q.includes('morning'))
    answer = '[MOCK] Start your day right with our breakfast recipes!';
  else if (q.includes('sauce') || q.includes('spread') || q.includes('condiment'))
    answer = '[MOCK] Enhance your dishes with our sauce and spread recipes!';
  else if (q.includes('wrap') || q.includes('sandwich'))
    answer = '[MOCK] Quick and easy sandwich and wrap ideas for you!';
  else if (q.includes('healthy') || q.includes('light') || q.includes('diet'))
    answer = '[MOCK] Nutritious and light recipes perfect for healthy eating!';
  else if (q.includes('asian') || q.includes('thai') || q.includes('chinese'))
    answer = '[MOCK] Explore delicious Asian-inspired meat recipes!';
  else if (q.includes('gluten') || q.includes('free') || q.includes('celiac'))
    answer = '[MOCK] Discover our gluten-free recipe collection!';

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
