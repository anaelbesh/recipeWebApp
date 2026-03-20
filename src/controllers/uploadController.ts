import { Response } from 'express';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
  file?: Express.Multer.File;
}

export async function uploadRecipeImage(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  // Return the URL where the file is accessible
  const imageUrl = `/uploads/recipe-images/${req.file.filename}`;
  res.json({ imageUrl });
}
