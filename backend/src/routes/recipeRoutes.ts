import { Router } from "express";
// Named import for comments
import { addComment } from "../controllers/commentController";
// Default import for likes
import likeController from "../controllers/likeController";

const router = Router();

// Route for adding a comment
// POST /api/recipes/:recipeId/comments
router.post("/:recipeId/comments", addComment);

// Route for toggling a like
// POST /api/recipes/:recipeId/likes
router.post("/:recipeId/likes", likeController.toggle);

export default router;