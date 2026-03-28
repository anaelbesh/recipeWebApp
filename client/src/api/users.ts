import type { User } from '../types/auth';
import apiClient from './client';

/**
 * User-profile API.
 * Sends multipart/form-data to PUT /api/users/me.
 * FormData fields:
 *   - username (optional text field)
 *   - avatar   (optional File — multer saves to disk, URL stored in DB)
 */
export const usersApi = {
  updateProfile: async (form: FormData): Promise<User> => {
    const { data } = await apiClient.put<{ user: User }>('/users/me', form);
    return data.user;
  },
};
