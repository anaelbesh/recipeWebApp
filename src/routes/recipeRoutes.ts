import { Router } from "express";
import { addComment } from "../controllers/commentController";
import likeController from "../controllers/likeController";
import { verifyToken, optionalVerifyToken } from "../middleware/authMiddleware";
import {
  getRecipes,
  getRecipeById,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  getCategories,
  aiSearchRecipes,
} from "../controllers/recipeController";

const router = Router();

// ── Recipe CRUD ────────────────────────────────────────────────────────────────
// GET  /api/recipes        – public list; optionalVerifyToken populates req.user
//                            when a token is present (needed for mine=true check in controller)
router.get("/", optionalVerifyToken, getRecipes as any);
// GET  /api/recipes/categories  – public static list of allowed categories
// MUST be before /:id so it doesn't get caught as an id
router.get('/categories', getCategories);
// GET  /api/recipes/ai-search   – semantic search via Gemini embeddings
// MUST be before /:id so it doesn't get caught as an id
router.get('/ai-search', aiSearchRecipes as any);
// GET  /api/recipes/:id    – public single recipe
router.get("/:id", getRecipeById as any);

// POST /api/recipes        – create (auth required)
router.post("/", verifyToken, createRecipe as any);

// PUT  /api/recipes/:id    – update (auth required, owner only)
router.put("/:id", verifyToken, updateRecipe as any);

// DELETE /api/recipes/:id  – delete (auth required, owner only)
router.delete("/:id", verifyToken, deleteRecipe as any);

// ── Comments & Likes (sub-resources) ──────────────────────────────────────────
// POST /api/recipes/:recipeId/comments
router.post("/:recipeId/comments", verifyToken, addComment);

// POST /api/recipes/:recipeId/likes
router.post("/:recipeId/likes", verifyToken, likeController.toggle);

export default router;