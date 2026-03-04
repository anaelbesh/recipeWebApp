import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/userModel';
import RefreshToken from '../models/refreshTokenModel';
import { authConfig } from '../config/auth';
import {
  getGoogleAuthUrl,
  exchangeGoogleCode,
  getFacebookAuthUrl,
  exchangeFacebookCode,
  verifyStateToken,
  OAuthProfile,
} from '../services/oauthService';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const generateTokens = (userId: string, username: string, email: string) => {
  const accessToken = jwt.sign({ id: userId, username, email }, authConfig.accessTokenSecret, {
    expiresIn: authConfig.accessTokenTtl,
  });
  const refreshToken = jwt.sign(
    { id: userId, jti: Math.random().toString(36) + Date.now().toString(36) },
    authConfig.refreshTokenSecret,
    { expiresIn: authConfig.refreshTokenTtl }
  );
  return { accessToken, refreshToken };
};

/**
 * Find an existing user by providerId or email (merge), or create a new one.
 * Returns the user document.
 */
const findOrCreateOAuthUser = async (
  profile: OAuthProfile,
  provider: 'google' | 'facebook'
) => {
  // 1. Look up by provider-specific ID (fastest, most accurate)
  let user = await User.findOne({ provider, providerId: profile.providerId });

  if (!user) {
    // 2. Try to merge with an existing local account using the same email
    user = await User.findOne({ email: profile.email });

    if (user) {
      // Merge: attach OAuth identity to the existing account
      user.provider = provider;
      user.providerId = profile.providerId;
      if (profile.profilePicture) user.profilePicture = profile.profilePicture;
      await user.save();
    } else {
      // 3. No existing account — create a new OAuth-only user
      user = await User.create({
        username: profile.username,
        email: profile.email,
        provider,
        providerId: profile.providerId,
        profilePicture: profile.profilePicture,
        // no password for OAuth users
      });
    }
  }

  return user;
};

const finishOAuthHandshake = async (
  user: Awaited<ReturnType<typeof findOrCreateOAuthUser>>,
  res: Response
) => {
  const { accessToken, refreshToken } = generateTokens(user._id.toString(), user.username, user.email);

  await RefreshToken.deleteMany({ userId: user._id });
  await RefreshToken.create({
    userId: user._id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + authConfig.refreshTokenTtlMs),
  });

  // Redirect client with tokens in the URL fragment / query string.
  // The frontend should read these and store them (localStorage / memory).
  const redirectUrl = new URL(`${authConfig.clientOrigin}/auth/callback`);
  redirectUrl.searchParams.set('accessToken', accessToken);
  redirectUrl.searchParams.set('refreshToken', refreshToken);
  redirectUrl.searchParams.set('username', user.username);
  redirectUrl.searchParams.set('email', user.email);
  redirectUrl.searchParams.set('userId', user._id.toString());
  if (user.profilePicture) redirectUrl.searchParams.set('profilePicture', user.profilePicture);
  return res.redirect(redirectUrl.toString());
};

// ─── Google ───────────────────────────────────────────────────────────────────

export const googleRedirect = (_req: Request, res: Response) => {
  const url = getGoogleAuthUrl();
  res.redirect(url);
};

export const googleCallback = async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query as { code?: string; state?: string };

    if (!state) return res.status(400).json({ message: 'Missing state parameter' });
    verifyStateToken(state); // throws on invalid

    if (!code) return res.status(400).json({ message: 'Missing authorization code' });

    const profile = await exchangeGoogleCode(code);
    const user = await findOrCreateOAuthUser(profile, 'google');
    return finishOAuthHandshake(user, res);
  } catch (err) {
    console.error('Google OAuth error:', err);
    return res.status(500).json({ message: 'Google authentication failed' });
  }
};

// ─── Facebook ─────────────────────────────────────────────────────────────────

export const facebookRedirect = (_req: Request, res: Response) => {
  const url = getFacebookAuthUrl();
  res.redirect(url);
};

export const facebookCallback = async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query as { code?: string; state?: string };

    if (!state) return res.status(400).json({ message: 'Missing state parameter' });
    verifyStateToken(state); // throws on invalid

    if (!code) return res.status(400).json({ message: 'Missing authorization code' });

    const profile = await exchangeFacebookCode(code);
    const user = await findOrCreateOAuthUser(profile, 'facebook');
    return finishOAuthHandshake(user, res);
  } catch (err) {
    console.error('Facebook OAuth error:', err);
    return res.status(500).json({ message: 'Facebook authentication failed' });
  }
};
