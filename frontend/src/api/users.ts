import type { User } from '../types/auth';
// import apiClient from './client'; // uncomment when backend endpoint exists

export interface UpdateProfilePayload {
  username?: string;
  profilePicture?: string; // base64 or URL — switch to FormData when backend lands
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * User-profile API.
 * Currently mocked — the backend edit-user endpoint doesn't exist yet.
 * When the endpoint is ready, flip USE_MOCK to false (or use VITE_USE_MOCK env var)
 * and uncomment the real implementation.
 */
const USE_MOCK = true;

export const usersApi = {
  updateProfile: async (
    userId: string,
    payload: UpdateProfilePayload,
  ): Promise<User> => {
    if (USE_MOCK) {
      await delay(600);
      return {
        id: userId,
        username: payload.username ?? 'mockuser',
        email: 'mock@example.com',
        profilePicture: payload.profilePicture,
      };
    }
    // Real implementation (uncomment when ready):
    // const { data } = await apiClient.put<User>(`/users/${userId}`, payload);
    // return data;
    throw new Error('Not implemented');
  },
};
