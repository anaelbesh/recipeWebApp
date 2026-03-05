import { Router } from 'express';
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

router.get('/me', verifyToken, getMe);
router.get('/', verifyToken, getAllUsers);
router.get('/:id', verifyToken, getUserById);
router.put('/me', verifyToken, avatarUpload.single('avatar'), updateMe);
router.put('/:id', verifyToken, updateUser);
router.delete('/:id', verifyToken, deleteUser);

export default router;
