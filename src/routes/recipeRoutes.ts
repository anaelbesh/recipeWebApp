import { Router } from "express";
import { addComment } from "../controllers/commentController";
import likeController from "../controllers/likeController";
import { verifyToken } from "../middleware/authMiddleware";

const router = Router();

// POST /api/recipes/:recipeId/comments
router.post("/:recipeId/comments", verifyToken, addComment);

// POST /api/recipes/:recipeId/likes
router.post("/:recipeId/likes", verifyToken, likeController.toggle);

export default router;