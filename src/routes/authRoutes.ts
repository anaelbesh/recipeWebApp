import { Router } from 'express';
import { register, login, logout, refreshToken } from '../controllers/authController';
import {
  googleRedirect,
  googleCallback,
  facebookRedirect,
  facebookCallback,
} from '../controllers/oauthController';
import { verifyToken } from '../middleware/authMiddleware';
import { validateLoginRequest, validateSignupRequest } from '../middleware/validationMiddleware';

const router = Router();

// Local auth
router.post('/register', validateSignupRequest, register);
router.post('/login', validateLoginRequest, login);
router.post('/logout', logout);
router.post('/refresh', refreshToken);

// Google OAuth
router.get('/google', googleRedirect);
router.get('/google/callback', googleCallback);

// Facebook OAuth
router.get('/facebook', facebookRedirect);
router.get('/facebook/callback', facebookCallback);

export default router;
