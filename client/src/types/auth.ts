/**
 * Mirrors the backend User shape returned by authController login/register.
 * The backend currently returns { id, username, email } — profilePicture and
 * provider are on the DB model but not yet sent in the auth response.
 * We include them as optional so the frontend is ready when the backend adds them.
 */
export interface User {
  id: string;
  username: string;
  email: string;
  profilePicture?: string;
  provider?: 'local' | 'google' | 'facebook';
}

/** Shape returned by POST /api/auth/login and POST /api/auth/register */
export interface AuthResponse {
  message: string;
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

/** Shape returned by POST /api/auth/refresh */
export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}
