import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/authMiddleware';
import * as recipeService from '../services/recipeService';
import { Recipe } from '../models/Recipe';
import { Comment } from '../models/Comment';
import { Like } from '../models/Like';
import { RECIPE_CATEGORIES } from '../constants/recipeCategories';
import { embedText, cosineSimilarity, EmbedError } from '../services/geminiEmbeddings';

const attachRecipeMeta = async (recipes: any[], userId?: string) => {
  if (!recipes.length) return recipes;

  const recipeIds = recipes.map((r) => new mongoose.Types.ObjectId(r._id));

  const [commentCounts, likeCounts, likedDocs] = await Promise.all([
    Comment.aggregate([
      { $match: { recipe: { $in: recipeIds } } },
      { $group: { _id: '$recipe', count: { $sum: 1 } } },
    ]),
    Like.aggregate([
      { $match: { recipe: { $in: recipeIds } } },
      { $group: { _id: '$recipe', count: { $sum: 1 } } },
    ]),
    userId
      ? Like.find({ user: userId, recipe: { $in: recipeIds } }, { recipe: 1 }).lean()
      : Promise.resolve([]),
  ]);

  const commentMap = new Map(commentCounts.map((c) => [String(c._id), c.count]));
  const likeMap = new Map(likeCounts.map((c) => [String(c._id), c.count]));
  const likedSet = new Set(likedDocs.map((l: any) => String(l.recipe)));

  return recipes.map((recipe) => {
    const id = String(recipe._id);
    return {
      ...recipe,
      commentCount: commentMap.get(id) ?? 0,
      likeCount: likeMap.get(id) ?? 0,
      likedByMe: userId ? likedSet.has(id) : false,
    };
  });
};

// ── GET /api/recipes/categories ───────────────────────────────────────────────
export const getCategories = (_req: AuthRequest, res: Response) => {
  res.status(200).json({ categories: RECIPE_CATEGORIES });
};

// ── GET /api/recipes ───────────────────────────────────────────────────────────
export const getRecipes = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, sort, mine, category, cursor } = req.query as Record<string, string>;
    const rawSearch = ((req.query.search as string | undefined) ?? (req.query.q as string | undefined) ?? '').trim();

    const search = rawSearch || undefined;

    // "mine=true" requires auth; the router conditionally applies verifyToken,
    // so we just trust req.user when present.
    const userId = req.user?.id;

    if (mine === 'true' && !userId) {
      return res.status(401).json({ message: 'Authentication required to fetch your recipes' });
    }

    const result = await recipeService.listRecipes({
      search,
      cursor: cursor || undefined,  // cursor-based pagination (overrides page when present)
      page:  Number(page)  || undefined,
      limit: Number(limit) || undefined,
      sort,
      mine:   mine === 'true',
      userId,
      category: category || undefined,
    });

    const items = await attachRecipeMeta(result.items as any[], userId);

    return res.status(200).json({ ...result, items });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error fetching recipes', error: error.message });
  }
};

// ── GET /api/recipes/:id ───────────────────────────────────────────────────────
export const getRecipeById = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid recipe id' });
    }

    const recipe = await recipeService.getRecipeById(id);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const [commentCount, likeCount, likedByMe] = await Promise.all([
      Comment.countDocuments({ recipe: id }),
      Like.countDocuments({ recipe: id }),
      userId ? Like.exists({ recipe: id, user: userId }) : Promise.resolve(null),
    ]);

    return res.status(200).json({
      recipe: {
        ...recipe,
        commentCount,
        likeCount,
        likedByMe: Boolean(likedByMe),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error fetching recipe', error: error.message });
  }
};

// ── POST /api/recipes ──────────────────────────────────────────────────────────
export const createRecipe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { title, instructions, ingredients, imageUrl, category, kosherType, cookingMethod, dishType } = req.body;

    if (!title || !instructions) {
      return res.status(400).json({ message: 'title and instructions are required' });
    }
    if (!category || !RECIPE_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: `category is required and must be one of: ${RECIPE_CATEGORIES.join(', ')}` });
    }

    const recipe = await recipeService.createRecipe({
      title,
      instructions,
      ingredients: Array.isArray(ingredients) ? ingredients : undefined,
      imageUrl,
      category,
      kosherType:    kosherType    || undefined,
      cookingMethod: cookingMethod || undefined,
      dishType:      dishType      || undefined,
      createdBy: userId,
    });

    return res.status(201).json({ message: 'Recipe created successfully', recipe });
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      return res.status(400).json({ message: messages.join('. ') });
    }
    return res.status(500).json({ message: 'Error creating recipe', error: error.message });
  }
};

// ── PUT /api/recipes/:id ───────────────────────────────────────────────────────
export const updateRecipe = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId  = req.user!.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid recipe id' });
    }

    // Ownership check
    const existing = await Recipe.findById(id).lean();
    if (!existing) {
      return res.status(404).json({ message: 'Recipe not found' });
    }
    if (existing.createdBy.toString() !== userId) {
      return res.status(403).json({ message: 'Forbidden: you are not the owner of this recipe' });
    }

    const { title, instructions, ingredients, imageUrl, category, kosherType, cookingMethod, dishType } = req.body;

    const updated = await recipeService.updateRecipe(id, {
      title,
      instructions,
      ingredients: Array.isArray(ingredients) ? ingredients : undefined,
      imageUrl,
      category: category && RECIPE_CATEGORIES.includes(category) ? category : undefined,
      kosherType:    kosherType    || undefined,
      cookingMethod: cookingMethod || undefined,
      dishType:      dishType      || undefined,
    });

    return res.status(200).json({ message: 'Recipe updated successfully', recipe: updated });
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      return res.status(400).json({ message: messages.join('. ') });
    }
    return res.status(500).json({ message: 'Error updating recipe', error: error.message });
  }
};

// ── DELETE /api/recipes/:id ────────────────────────────────────────────────────
export const deleteRecipe = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId  = req.user!.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid recipe id' });
    }

    // Ownership check
    const existing = await Recipe.findById(id).lean();
    if (!existing) {
      return res.status(404).json({ message: 'Recipe not found' });
    }
    if (existing.createdBy.toString() !== userId) {
      return res.status(403).json({ message: 'Forbidden: you are not the owner of this recipe' });
    }

    await recipeService.deleteRecipe(id);

    return res.status(200).json({ message: 'Recipe deleted successfully', deletedId: id });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error deleting recipe', error: error.message });
  }
};

// ── GET /api/recipes/ai-search?q=...&category=...&limit=... ───────────────────
export const aiSearchRecipes = async (req: AuthRequest, res: Response) => {
  try {
    const q        = (req.query.q        as string | undefined)?.trim() ?? '';
    const category = (req.query.category as string | undefined)?.trim() ?? '';
    const rawLimit = Number(req.query.limit) || 10;
    const limit    = Math.min(30, Math.max(1, rawLimit));

    if (q.length < 2) {
      return res.status(400).json({ message: 'Query must be at least 2 characters' });
    }

    console.log(`[ai-search] query="${q}" category="${category || 'any'}" limit=${limit}`);

    // ── 1. Try Gemini semantic search ─────────────────────────────────────────
    let qEmbedding: number[] | null = null;
    let embedErrorReason: string | null = null;
    let embedHint: string | null = null;

    try {
      qEmbedding = await embedText(q);
    } catch (err: unknown) {
      // Original issue: embedText was swallowing errors and returning null,
      // causing a blind 503. Now we catch EmbedError and fall back gracefully.
      if (err instanceof EmbedError) {
        embedErrorReason = err.message;
        embedHint = err.hint ?? null;
      } else {
        embedErrorReason = (err as any)?.message ?? 'Unknown embedding error';
      }
      console.warn(`[ai-search] Embedding failed — will use text-search fallback. Reason: ${embedErrorReason}`);
    }

    if (qEmbedding) {
      // ── Semantic path ────────────────────────────────────────────────────────
      const filter: Record<string, unknown> = {
        embedding: { $exists: true, $not: { $size: 0 } },
      };
      if (category && category !== 'All') {
        filter.category = category;
      }

      const candidates = await Recipe.find(filter)
        .sort({ createdAt: -1 })
        .limit(500)
        .populate('createdBy', 'username profilePicture')
        .lean();

      if (candidates.length === 0) {
        return res.status(200).json({
          items: [],
          totalCandidates: 0,
          returned: 0,
          aiUsed: true,
          message: 'No AI index yet — recipes will be indexed automatically as they are created/updated. Run `npm run backfill:embeddings` to index existing recipes.',
        });
      }

      const scored = candidates
        .map((recipe) => ({
          ...recipe,
          score: cosineSimilarity(qEmbedding!, recipe.embedding ?? []),
        }))
        .filter((r) => r.score > -1)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return res.status(200).json({
        items: scored,
        totalCandidates: candidates.length,
        returned: scored.length,
        aiUsed: true,
      });
    }

    // ── 2. Fallback: MongoDB full-text search ────────────────────────────────
    // Reached when Gemini is unavailable (wrong key, quota, network, etc.).
    // Returns 200 so the UI remains functional; aiUsed=false signals degraded mode.
    console.log('[ai-search] Using text-search fallback');

    try {
      const filter: Record<string, unknown> = {
        $text: { $search: q },
      };
      if (category && category !== 'All') {
        filter.category = category;
      }

      const fallbackItems = await Recipe.find(filter, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit)
        .populate('createdBy', 'username profilePicture')
        .lean();

      return res.status(200).json({
        items: fallbackItems,
        returned: fallbackItems.length,
        aiUsed: false,
        fallback: 'textSearch',
        message: `AI search unavailable${embedErrorReason ? ` (${embedErrorReason})` : ''} — showing keyword results instead.`,
        ...(embedHint ? { hint: embedHint } : {}),
      });
    } catch (textErr: any) {
      // Text index might not exist yet — fall back further to a simple regex on title
      console.warn('[ai-search] Text-search fallback failed, trying regex fallback:', textErr.message);

      const regexFilter: Record<string, unknown> = {
        title: { $regex: q, $options: 'i' },
      };
      if (category && category !== 'All') {
        regexFilter.category = category;
      }

      const regexItems = await Recipe.find(regexFilter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('createdBy', 'username profilePicture')
        .lean();

      return res.status(200).json({
        items: regexItems,
        returned: regexItems.length,
        aiUsed: false,
        fallback: 'regexSearch',
        message: `AI search unavailable${embedErrorReason ? ` (${embedErrorReason})` : ''} — showing title-match results instead.`,
        ...(embedHint ? { hint: embedHint } : {}),
      });
    }
  } catch (error: any) {
    console.error('[ai-search] Unexpected error:', error);
    return res.status(500).json({ message: 'Error performing AI search', error: error.message });
  }
};
