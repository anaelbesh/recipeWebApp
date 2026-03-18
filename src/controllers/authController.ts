import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/userModel';
import RefreshToken from '../models/refreshTokenModel';
import { authConfig } from '../config/auth';
// import { AuthRequest } from '../middleware/authMiddleware'; // needed when userController is added

// Helper function to generate tokens
const generateTokens = (userId: string, username: string, email: string): { accessToken: string; refreshToken: string } => {
    const accessToken = jwt.sign({ id: userId, username, email }, authConfig.accessTokenSecret, { expiresIn: authConfig.accessTokenTtl });
    const refreshToken = jwt.sign(
      { id: userId, jti: Math.random().toString(36) + Date.now().toString(36) }, 
      authConfig.refreshTokenSecret, 
      { expiresIn: authConfig.refreshTokenTtl }
    );
    
    return { accessToken, refreshToken };
};

// Register new user
export const register = async (req: Request, res: Response) => {
  try {
    const { username, email, password, rememberMe } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      provider: 'local',
    });

    const { accessToken, refreshToken } = generateTokens(user._id.toString(), user.username, user.email);

    const isRememberMe = Boolean(rememberMe);
    const ttlMs = isRememberMe ? authConfig.rememberMeTtlMs : authConfig.refreshTokenTtlMs;

    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + ttlMs),
      rememberMe: isRememberMe
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: { id: user._id, username: user.username, email: user.email, profilePicture: user.profilePicture },
      accessToken,
      refreshToken
    });
  } catch (error) {
    res.status(500).json({ message: 'Error registering user' });
  }
};

// Login user
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.provider !== 'local') {
      return res.status(400).json({
        message: `This account uses ${user.provider} sign-in. Please log in with ${user.provider} instead.`,
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password!);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user._id.toString(), user.username, user.email);

    // Delete old refresh tokens for this user to avoid duplicates
    await RefreshToken.deleteMany({ userId: user._id });
    
    const isRememberMe = Boolean(rememberMe);
    const ttlMs = isRememberMe ? authConfig.rememberMeTtlMs : authConfig.refreshTokenTtlMs;

    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + ttlMs),
      rememberMe: isRememberMe
    });

    res.status(200).json({
      message: 'Login successful',
      user: { id: user._id, username: user.username, email: user.email, profilePicture: user.profilePicture },
      accessToken,
      refreshToken
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in' });
  }
};

// Refresh access token
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, authConfig.refreshTokenSecret) as { id: string };

    const tokenDoc = await RefreshToken.findOne({ token: refreshToken, userId: decoded.id });
    if (!tokenDoc) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    // Check if token has expired
    if (tokenDoc.expiresAt < new Date()) {
      await RefreshToken.deleteOne({ token: refreshToken });
      return res.status(403).json({ message: 'Refresh token has expired' });
    }

    await RefreshToken.deleteOne({ token: refreshToken });

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user._id.toString(), user.username, user.email);

    // Preserve the rememberMe flag from the old token
    const isRememberMe = tokenDoc.rememberMe || false;
    const ttlMs = isRememberMe ? authConfig.rememberMeTtlMs : authConfig.refreshTokenTtlMs;

    await RefreshToken.create({
      userId: decoded.id,
      token: newRefreshToken,
      expiresAt: new Date(Date.now() + ttlMs),
      rememberMe: isRememberMe
    });

    res.status(200).json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired refresh token' });
  }
};

// Logout user
export const logout = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token required' });
    }

    await RefreshToken.deleteOne({ token: refreshToken });

    res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    res.status(500).json({ message: 'Error logging out' });
  }
};