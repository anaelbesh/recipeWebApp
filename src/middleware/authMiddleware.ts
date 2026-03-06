import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authConfig } from '../config/auth';

export interface AuthRequest extends Request {
  user?: { id: string };
}

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization header missing or malformed' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, authConfig.accessTokenSecret) as { id: string };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

/**
 * Like verifyToken but never blocks the request.
 * If a valid Bearer token is present, req.user is populated.
 * If the token is missing or invalid, the request continues without req.user.
 */
export const optionalVerifyToken = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, authConfig.accessTokenSecret) as { id: string };
      req.user = decoded;
    } catch {
      // token invalid — just proceed without req.user
    }
  }
  next();
};
