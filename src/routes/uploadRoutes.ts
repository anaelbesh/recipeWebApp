import { Router, NextFunction, Request, Response } from 'express';
import { verifyToken } from '../middleware/authMiddleware';
import { createUpload } from '../middleware/upload';
import { uploadRecipeImage } from '../controllers/uploadController';

const router = Router();

// Configure multer for recipe images
const recipeImageUpload = createUpload('recipe-images');

// Error handler for multer errors
const handleMulterError = (err: any, res: Response) => {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 5MB limit' });
    }
    if (err.message.includes('Only jpg, png, and webp')) {
      return res.status(400).json({ error: 'Only jpg, png, and webp images are allowed' });
    }
    return res.status(500).json({ error: err.message || 'File upload failed' });
  }
};

// POST /api/uploads/recipe-image
// Requires authentication. Accepts multipart/form-data with field "image".
// Returns { imageUrl: "/uploads/recipe-images/<filename>" }
router.post(
  '/recipe-image',
  verifyToken,
  (req: Request, res: Response, next: NextFunction) => {
    recipeImageUpload.single('image')(req, res, (err: any) => {
      if (err) {
        return handleMulterError(err, res);
      }
      next();
    });
  },
  uploadRecipeImage as any,
);

export default router;
