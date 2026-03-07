import apiClient, { tokenStorage } from './client';
import type { AuthResponse, LoginPayload, RegisterPayload, User } from '../types/auth';

export const authApi = {
  /**
   * POST /api/auth/login
   * Backend returns: { message, user: { id, username, email }, accessToken, refreshToken }
   */
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
    tokenStorage.setAccess(data.accessToken);
    tokenStorage.setRefresh(data.refreshToken);
    return data;
  },

  /**
   * POST /api/auth/register
   * Backend returns same shape as login.
   */
  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>('/auth/register', payload);
    tokenStorage.setAccess(data.accessToken);
    tokenStorage.setRefresh(data.refreshToken);
    return data;
  },

  /**
   * POST /api/auth/logout
   * Sends the refresh token so the backend can delete it.
   */
  logout: async (): Promise<void> => {
    const refreshToken = tokenStorage.getRefresh();
    if (refreshToken) {
      await apiClient.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    tokenStorage.clear();
  },

  /**
   * Restore the current user by fetching the full profile from the DB.
   * Uses GET /api/users/me — requires a valid access token (attached automatically
   * by the apiClient request interceptor). Falls back to null if no token or request fails.
   * This ensures profilePicture and other DB fields are always up-to-date after refresh.
   */
  me: async (): Promise<User | null> => {
    if (!tokenStorage.getAccess()) return null;
    try {
      const { data } = await apiClient.get<{ user: User & { _id?: string } }>('/users/me');
      const raw = data.user;
      // Mongoose serializes documents with both `_id` and the `id` virtual.
      // Normalize defensively so user.id is always populated regardless of shape.
      return {
        ...raw,
        id: raw.id ?? raw._id ?? '',
      };
    } catch {
      // 401 with no valid refresh token: the axios interceptor already cleared
      // storage and will redirect to /login. Return null so hydration can finish.
      tokenStorage.clear();
      return null;
    }
  },
};
