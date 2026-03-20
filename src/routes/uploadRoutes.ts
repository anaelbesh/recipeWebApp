import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware';
import { createUpload } from '../middleware/upload';
import { uploadRecipeImage } from '../controllers/uploadController';

const router = Router();

// Configure multer for recipe images
const recipeImageUpload = createUpload('recipe-images');

// POST /api/uploads/recipe-image
// Requires authentication. Accepts multipart/form-data with field "image".
// Returns { imageUrl: "/uploads/recipe-images/<filename>" }
router.post(
  '/recipe-image',
  verifyToken,
  recipeImageUpload.single('image'),
  uploadRecipeImage as any,
);

export default router;
