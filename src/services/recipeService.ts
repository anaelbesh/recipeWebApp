import mongoose from 'mongoose';
import { Recipe } from '../models/Recipe';

export interface RecipeListQuery {
  search?: string;
  page?: number;
  limit?: number;
  sort?: string;
  mine?: boolean;
  userId?: string;
}

export interface RecipeCreateInput {
  title: string;
  instructions: string;
  ingredients?: string[];
  imageUrl?: string;
  createdBy: string;
}

export interface RecipeUpdateInput {
  title?: string;
  instructions?: string;
  ingredients?: string[];
  imageUrl?: string;
}

// ── List / search ──────────────────────────────────────────────────────────────
export const listRecipes = async (query: RecipeListQuery) => {
  const page  = Math.max(1, Number(query.page)  || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
  const skip  = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (query.mine && query.userId) {
    filter.createdBy = new mongoose.Types.ObjectId(query.userId);
  }

  let mongoSort: Record<string, unknown>;

  if (query.search) {
    filter.$text = { $search: query.search };
    mongoSort = { score: { $meta: 'textScore' }, createdAt: -1 };
  } else {
    // Accept sort param like "-createdAt" or "title"
    const sortField  = (query.sort || '-createdAt').replace(/^-/, '');
    const sortOrder  = (query.sort || '-createdAt').startsWith('-') ? -1 : 1;
    mongoSort = { [sortField]: sortOrder };
  }

  const [items, total] = await Promise.all([
    Recipe.find(filter, query.search ? { score: { $meta: 'textScore' } } : undefined)
      .sort(mongoSort as any)
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'username profilePicture')
      .lean(),
    Recipe.countDocuments(filter),
  ]);

  return {
    items,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
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
  if (input.ingredients !== undefined) {
    recipe.ingredients = input.ingredients.map((s) => s.trim()).filter((s) => s.length > 0);
  }

  await recipe.save(); // runs schema validators
  return recipe;
};

// ── Delete ─────────────────────────────────────────────────────────────────────
export const deleteRecipe = async (id: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return Recipe.findByIdAndDelete(id).lean();
};
