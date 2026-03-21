import { Request, Response, NextFunction } from 'express';
import {
  validateEmail,
  validatePassword,
  validateUsername,
  normalizeEmail,
  normalizePassword,
  normalizeUsername,
} from '../shared/validation';

export interface ValidatedAuthRequest extends Request {
  validated?: {
    email?: string;
    password?: string;
    username?: string;
  };
}

/**
 * Middleware: Validate login request
 * POST /api/auth/login { email, password }
 */
export const validateLoginRequest = (
  req: ValidatedAuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const errors: Record<string, string> = {};

  // ── Validate email ───────────────────────────────────────────────────
  if (!email) {
    errors.email = 'Email is required';
  } else {
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      errors.email = emailValidation.error || 'Invalid email';
    }
  }

  // ── Validate password ────────────────────────────────────────────────
  if (!password) {
    errors.password = 'Password is required';
  } else if (password.length === 0) {
    errors.password = 'Password is required';
  }

  // ── If validation failed, return error ───────────────────────────────
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      message: 'Validation failed',
      errors,
    });
  }

  // ── Normalize values and attach to request ────────────────────────────
  req.validated = {
    email: normalizeEmail(email!),
    password: password!,
  };

  next();
};

/**
 * Middleware: Validate signup/register request
 * POST /api/auth/register { username, email, password }
 */
export const validateSignupRequest = (
  req: ValidatedAuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { username, email, password } = req.body as {
    username?: string;
    email?: string;
    password?: string;
  };
  const errors: Record<string, string | string[]> = {};

  // ── Validate username ────────────────────────────────────────────────
  if (!username) {
    errors.username = 'Username is required';
  } else {
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      errors.username = usernameValidation.error || 'Invalid username';
    }
  }

  // ── Validate email ───────────────────────────────────────────────────
  if (!email) {
    errors.email = 'Email is required';
  } else {
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      errors.email = emailValidation.error || 'Invalid email';
    }
  }

  // ── Validate password ────────────────────────────────────────────────
  if (!password) {
    errors.password = 'Password is required';
  } else {
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      errors.password = passwordValidation.errors; // Array of errors
    }
  }

  // ── If validation failed, return error ───────────────────────────────
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      message: 'Validation failed',
      errors,
    });
  }

  // ── Normalize values and attach to request ────────────────────────────
  req.validated = {
    username: normalizeUsername(username!),
    email: normalizeEmail(email!),
    password: normalizePassword(password!),
  };

  next();
};
