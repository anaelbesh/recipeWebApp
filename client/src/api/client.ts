import axios from 'axios';

const TOKEN_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

/**
 * Thin wrapper around localStorage for token persistence.
 * Both access and refresh tokens are stored here — the backend uses
 * body-based token exchange (no cookies), so localStorage is the correct approach.
 * User info (username, email) is embedded in the JWT payload so no separate
 * user cache is needed.
 */
export const tokenStorage = {
  getAccess: () => localStorage.getItem(TOKEN_KEY),
  setAccess: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  setRefresh: (t: string) => localStorage.setItem(REFRESH_KEY, t),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

const apiClient = axios.create({
  baseURL: '/api',
});

// ── Request interceptor: attach access token ──────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: silent refresh on 401 ───────────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return apiClient(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = tokenStorage.getRefresh();
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        tokenStorage.setAccess(data.accessToken);
        tokenStorage.setRefresh(data.refreshToken);
        processQueue(null, data.accessToken);

        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(original);
      } catch (err) {
        processQueue(err, null);
        tokenStorage.clear();
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
