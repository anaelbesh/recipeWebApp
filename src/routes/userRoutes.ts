import { NextFunction, Request, Response, Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware';
import { createUpload } from '../middleware/upload';
import {
  getMe,
  getAllUsers,
  getUserById,
  updateMe,
  updateUser,
  deleteUser,
} from '../controllers/userController';

const router = Router();
const avatarUpload = createUpload('avatars');

const handleMulterError = (err: any, res: Response) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File size exceeds 5MB limit' });
  }
  if (typeof err.message === 'string' && err.message.includes('Only jpg, png, and webp')) {
    return res.status(400).json({ message: 'Only jpg, png, and webp images are allowed' });
  }
  return res.status(500).json({ message: err.message || 'File upload failed' });
};

router.get('/me', verifyToken, getMe);
router.get('/', verifyToken, getAllUsers);
router.get('/:id', verifyToken, getUserById);
router.put(
  '/me',
  verifyToken,
  (req: Request, res: Response, next: NextFunction) => {
    avatarUpload.single('avatar')(req, res, (err: any) => {
      if (err) return handleMulterError(err, res);
      next();
    });
  },
  updateMe,
);
router.put('/:id', verifyToken, updateUser);
router.delete('/:id', verifyToken, deleteUser);

export default router;
