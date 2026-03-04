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
   * Restore the current user from the stored access token.
   * The backend JWT payload only contains { id }, so we decode it client-side.
   * TODO: replace with a real GET /api/users/me endpoint when the backend adds one.
   */
  me: async (): Promise<User | null> => {
    const token = tokenStorage.getAccess();
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      return {
        id: payload.id ?? payload._id ?? '',
        username: payload.username ?? '',
        email: payload.email ?? '',
      };
    } catch {
      return null;
    }
  },
};
