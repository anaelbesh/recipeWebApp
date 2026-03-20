import mongoose from 'mongoose';
import { Recipe } from '../models/Recipe';
import { embedText, buildSearchText } from './geminiEmbeddings';

export interface RecipeListQuery {
  search?: string;
  /** Cursor for cursor-based pagination (base64url JSON {date,id}). Preferred over page. */
  cursor?: string;
  /** Legacy page number — used for search results or explicit page requests. */
  page?: number;
  limit?: number;
  sort?: string;
  mine?: boolean;
  userId?: string;
  category?: string;
}

export interface RecipeCreateInput {
  title: string;
  instructions: string;
  ingredients?: string[];
  imageUrl?: string;
  category: string;
  kosherType?: string;
  cookingMethod?: string;
  dishType?: string;
  createdBy: string;
}

export interface RecipeUpdateInput {
  title?: string;
  instructions?: string;
  ingredients?: string[];
  imageUrl?: string;
  category?: string;
  kosherType?: string;
  cookingMethod?: string;
  dishType?: string;
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── List / search ──────────────────────────────────────────────────────────────
export const listRecipes = async (query: RecipeListQuery) => {
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));

  // ── Base filter (no cursor — used for total count) ─────────────────────────
  const baseFilter: Record<string, unknown> = {};

  if (query.mine && query.userId) {
    baseFilter.createdBy = new mongoose.Types.ObjectId(query.userId);
  }

  // Category filter — skip if not provided or "All"
  if (query.category && query.category !== 'All') {
    baseFilter.category = query.category;
  }

  const cleanedSearch = typeof query.search === 'string' ? query.search.trim() : '';
  const hasSearch = cleanedSearch.length >= 2;

  if (hasSearch) {
    const regex = escapeRegex(cleanedSearch);
    baseFilter.title = { $regex: regex, $options: 'i' };
  }

  const sortConfig = query.sort || '-createdAt';
  const sortField  = sortConfig.replace(/^-/, '');
  const sortOrder  = sortConfig.startsWith('-') ? -1 : 1;
  const mongoSort = { [sortField]: sortOrder, _id: -1 };

  // ── Build page filter (adds cursor condition for cursor-based pagination) ───
  // Cursor is only used for non-search queries (stable sort required for correct pagination).
  const pageFilter: Record<string, unknown> = { ...baseFilter };
  let skip = 0;

  if (query.cursor && !hasSearch) {
    // Cursor-based: decode and apply range condition so we pick up exactly where we left off.
    // Cursor format: base64url(JSON { date: isoString, id: hexObjectId })
    try {
      const decoded = JSON.parse(
        Buffer.from(query.cursor, 'base64url').toString(),
      ) as { date: string; id: string };
      const cursorDate = new Date(decoded.date);
      const cursorId   = new mongoose.Types.ObjectId(decoded.id);

      // With sort {createdAt:-1, _id:-1}: next page has createdAt < cursorDate
      // OR (same createdAt but _id < cursorId).
      pageFilter.$or = [
        { createdAt: { $lt: cursorDate } },
        { createdAt: cursorDate, _id: { $lt: cursorId } },
      ];
    } catch {
      // Invalid cursor — treat as first page (no range filter applied)
    }
  } else if (!query.cursor) {
    // Legacy page-based skip (used for text-search scroll or explicit page requests)
    const page = Math.max(1, Number(query.page) || 1);
    skip = (page - 1) * limit;
  }

  // ── Fetch limit+1 to cheaply detect hasMore, plus total count ───────────────
  const [rawItems, total] = await Promise.all([
    Recipe.find(pageFilter)
      .sort(mongoSort as any)
      .skip(skip)
      .limit(limit + 1)          // +1 lets us detect whether a next page exists
      .populate('createdBy', 'username profilePicture')
      .lean(),
    Recipe.countDocuments(baseFilter), // total without cursor filter
  ]);

  const hasMore = rawItems.length > limit;
  const items   = hasMore ? rawItems.slice(0, limit) : rawItems;

  // ── Build nextCursor from the last item in this page ───────────────────────
  // Only meaningful for non-search queries (cursor pagination requires stable order).
  let nextCursor: string | null = null;
  if (hasMore && items.length > 0 && !hasSearch) {
    const last = items[items.length - 1] as any;
    nextCursor = Buffer.from(
      JSON.stringify({
        date: (last.createdAt as Date).toISOString(),
        id:   last._id.toString(),
      }),
    ).toString('base64url');
  }

  // Legacy page-based fields — kept so existing callers (ProfilePage, tests) don't break
  const page  = Math.max(1, Number(query.page) || 1);
  const pages = Math.ceil(total / limit);

  return {
    items,
    nextCursor,   // string | null — use this for the next cursor-based request
    hasMore,      // true when there are more items to fetch
    total,
    page,
    limit,
    pages,
  };
};

// ── Get one ────────────────────────────────────────────────────────────────────
export const getRecipeById = async (id: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return Recipe.findById(id).populate('createdBy', 'username profilePicture').lean();
};

// ── Create ─────────────────────────────────────────────────────────────────────
export const createRecipe = async (input: RecipeCreateInput) => {
  const ingredients = (input.ingredients ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const recipe = await Recipe.create({ ...input, ingredients, createdBy: new mongoose.Types.ObjectId(input.createdBy) });

  // Trigger embedding async — best-effort, never blocks the response
  setImmediate(async () => {
    try {
      const searchText = buildSearchText(
        recipe.title,
        recipe.category,
        recipe.ingredients,
        recipe.instructions,
        recipe.kosherType,
        recipe.cookingMethod,
        recipe.dishType,
      );
      const embedding = await embedText(searchText);
      await Recipe.findByIdAndUpdate(recipe._id, { searchText, embedding });
    } catch (err: any) {
      console.error('[recipeService] Failed to embed recipe after create:', err?.message ?? err);
    }
  });

  return recipe;
};

// ── Update ─────────────────────────────────────────────────────────────────────
export const updateRecipe = async (id: string, input: RecipeUpdateInput) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  const recipe = await Recipe.findById(id);
  if (!recipe) return null;

  if (input.title       !== undefined) recipe.title        = input.title;
  if (input.instructions !== undefined) recipe.instructions = input.instructions;
  if (input.imageUrl    !== undefined) recipe.imageUrl     = input.imageUrl;
  if (input.category    !== undefined) recipe.category     = input.category;
  if (input.kosherType    !== undefined) (recipe as any).kosherType    = input.kosherType;
  if (input.cookingMethod !== undefined) (recipe as any).cookingMethod = input.cookingMethod;
  if (input.dishType      !== undefined) (recipe as any).dishType      = input.dishType;
  if (input.ingredients !== undefined) {
    recipe.ingredients = input.ingredients.map((s) => s.trim()).filter((s) => s.length > 0);
  }

  await recipe.save(); // runs schema validators

  // Trigger embedding async — best-effort, never blocks the response
  const savedRecipe = recipe;
  setImmediate(async () => {
    try {
      const searchText = buildSearchText(
        savedRecipe.title,
        savedRecipe.category,
        savedRecipe.ingredients,
        savedRecipe.instructions,
        (savedRecipe as any).kosherType,
        (savedRecipe as any).cookingMethod,
        (savedRecipe as any).dishType,
      );
      const embedding = await embedText(searchText);
      await Recipe.findByIdAndUpdate(savedRecipe._id, { searchText, embedding });
    } catch (err: any) {
      console.error('[recipeService] Failed to embed recipe after update:', err?.message ?? err);
    }
  });

  return recipe;
};

// ── Delete ─────────────────────────────────────────────────────────────────────
export const deleteRecipe = async (id: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return Recipe.findByIdAndDelete(id).lean();
};
