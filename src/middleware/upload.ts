import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Factory that returns a configured multer instance for a given subfolder.
 * Usage:
 *   const avatarUpload = createUpload('avatars');
 *   router.put('/me', verifyToken, avatarUpload.single('avatar'), updateMe);
 *
 * Files are saved to:  data/uploads/<subfolder>/<userId>-<timestamp>.<ext>
 * They are served at:  /uploads/<subfolder>/<filename>
 */
export function createUpload(subfolder: string) {
  const dest = path.join('data', 'uploads', subfolder);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename: (req, file, cb) => {
      const userId = (req as AuthenticatedRequest).user?.id ?? 'unknown';
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${userId}-${Date.now()}${ext}`);
    },
  });

  const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, png, and webp images are allowed'));
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  });
}
