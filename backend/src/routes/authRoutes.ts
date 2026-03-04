import { Router } from 'express';
import { register, login, logout, refreshToken } from '../controllers/authController';
import {
  googleRedirect,
  googleCallback,
  facebookRedirect,
  facebookCallback,
} from '../controllers/oauthController';

const router = Router();

// Local auth
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refreshToken);

// Google OAuth
router.get('/google', googleRedirect);
router.get('/google/callback', googleCallback);

// Facebook OAuth
router.get('/facebook', facebookRedirect);
router.get('/facebook/callback', facebookCallback);

export default router;
