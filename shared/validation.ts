/**
 * Shared validation utilities for authentication
 * Used by both frontend and backend to ensure consistent validation
 */

// ── Email Validation ───────────────────────────────────────────────────────
/**
 * Validates email format using a standard regex pattern
 * Accepts format: local@domain.tld
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): { valid: boolean; error?: string } {
  const trimmed = email.trim();

  if (!trimmed) {
    return { valid: false, error: 'Email is required' };
  }

  if (trimmed.length > 254) {
    return { valid: false, error: 'Email must be less than 254 characters' };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address (e.g., user@example.com)' };
  }

  return { valid: true };
}

/**
 * Normalizes email: trim whitespace and convert to lowercase
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ── Password Validation ────────────────────────────────────────────────────
/**
 * Password strength requirements:
 * - Minimum 8 characters (recommend 10+)
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 lowercase letter (a-z)
 * - At least 1 number (0-9)
 * - At least 1 special character (!@#$%^&*)
 * - No leading/trailing spaces
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_SPECIAL_CHARS = '!@#$%^&*';

interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
    noLeadingTrailing: boolean;
  };
}

export function validatePassword(password: string): PasswordValidationResult {
  const requirements = {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecialChar: new RegExp(`[${PASSWORD_SPECIAL_CHARS.replace(/[\[\]\\]/g, '\\$&')}]`).test(password),
    noLeadingTrailing: password === password.trim(),
  };

  const errors: string[] = [];

  if (!requirements.minLength) {
    errors.push(`At least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (!requirements.hasUppercase) {
    errors.push('At least 1 uppercase letter (A-Z)');
  }
  if (!requirements.hasLowercase) {
    errors.push('At least 1 lowercase letter (a-z)');
  }
  if (!requirements.hasNumber) {
    errors.push('At least 1 number (0-9)');
  }
  if (!requirements.hasSpecialChar) {
    errors.push(`At least 1 special character (${PASSWORD_SPECIAL_CHARS})`);
  }
  if (!requirements.noLeadingTrailing) {
    errors.push('No leading or trailing spaces');
  }

  return {
    valid: errors.length === 0,
    errors,
    requirements,
  };
}

/**
 * Trims password whitespace (leading/trailing only, not internal)
 */
export function normalizePassword(password: string): string {
  return password.trim();
}

// ── Username Validation ────────────────────────────────────────────────────
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 50;

export function validateUsername(username: string): { valid: boolean; error?: string } {
  const trimmed = username.trim();

  if (!trimmed) {
    return { valid: false, error: 'Username is required' };
  }

  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return { valid: false, error: `Username must be at least ${USERNAME_MIN_LENGTH} characters` };
  }

  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return { valid: false, error: `Username must be less than ${USERNAME_MAX_LENGTH} characters` };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { valid: false, error: 'Username can only contain letters, numbers, hyphens, and underscores' };
  }

  return { valid: true };
}

/**
 * Normalizes username: trim whitespace
 */
export function normalizeUsername(username: string): string {
  return username.trim();
}
