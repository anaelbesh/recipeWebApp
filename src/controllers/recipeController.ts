import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/authMiddleware';
import * as recipeService from '../services/recipeService';
import { Recipe } from '../models/Recipe';
import { RECIPE_CATEGORIES } from '../constants/recipeCategories';

// ── GET /api/recipes/categories ───────────────────────────────────────────────
export const getCategories = (_req: AuthRequest, res: Response) => {
  res.status(200).json({ categories: RECIPE_CATEGORIES });
};

// ── GET /api/recipes ───────────────────────────────────────────────────────────
export const getRecipes = async (req: AuthRequest, res: Response) => {
  try {
    const { search, page, limit, sort, mine, category } = req.query as Record<string, string>;

    // "mine=true" requires auth; the router conditionally applies verifyToken,
    // so we just trust req.user when present.
    const userId = req.user?.id;

    if (mine === 'true' && !userId) {
      return res.status(401).json({ message: 'Authentication required to fetch your recipes' });
    }

    const result = await recipeService.listRecipes({
      search,
      page:  Number(page)  || undefined,
      limit: Number(limit) || undefined,
      sort,
      mine:   mine === 'true',
      userId,
      category: category || undefined,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ message: 'Error fetching recipes', error: error.message });
  }
};

// ── GET /api/recipes/:id ───────────────────────────────────────────────────────
export const getRecipeById = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid recipe id' });
    }

    const recipe = await recipeService.getRecipeById(id);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    return res.status(200).json({ recipe });
  } catch (error: any) {
    return res.status(500).json({ message: 'Error fetching recipe', error: error.message });
  }
};

// ── POST /api/recipes ──────────────────────────────────────────────────────────
export const createRecipe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { title, instructions, ingredients, imageUrl, category } = req.body;

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

    const { title, instructions, ingredients, imageUrl, category } = req.body;

    const updated = await recipeService.updateRecipe(id, {
      title,
      instructions,
      ingredients: Array.isArray(ingredients) ? ingredients : undefined,
      imageUrl,
      category: category && RECIPE_CATEGORIES.includes(category) ? category : undefined,
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
