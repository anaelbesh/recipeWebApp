import { useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { ProtectedRoute } from './ProtectedRoute';
import { tokenStorage } from '../api/client';
import { authApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import type { User } from '../types/auth';
import { ChatPage } from '../components/Chat';

// Placeholder pages — implemented in upcoming chunks
function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={{ padding: 40, maxWidth: 600, margin: '0 auto' }}>
      <h1>Profile</h1>
      <p>
        <strong>ID:</strong> {user?.id}
      </p>
      <p>
        <strong>Username:</strong> {user?.username || '—'}
      </p>
      <p>
        <strong>Email:</strong> {user?.email || '—'}
      </p>
      <p style={{ color: '#6b7280', marginTop: 16 }}>
        Full profile page coming in Chunk 2
      </p>
      <a
        href="/chat"
        style={{
          display: 'inline-block',
          marginTop: 16,
          padding: '8px 20px',
          background: '#667eea',
          color: 'white',
          borderRadius: 8,
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Go to Chat
      </a>
      <button
        onClick={handleLogout}
        style={{
          marginTop: 24,
          padding: '8px 20px',
          background: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        Logout
      </button>
    </div>
  );
}

function FeedPage() {
  return (
    <div style={{ padding: 40 }}>
      <h1>Feed</h1>
      <p style={{ color: '#6b7280' }}>Coming in Chunk 3</p>
    </div>
  );
}

/**
 * Handles the redirect from the backend OAuth flow.
 * The backend redirects to /auth/callback?accessToken=...&refreshToken=...
 */
function OAuthCallback() {
  const { setUser } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (accessToken && refreshToken) {
      tokenStorage.setAccess(accessToken);
      tokenStorage.setRefresh(refreshToken);
      authApi.me().then((u: User | null) => {
        if (u) setUser(u);
        navigate('/profile', { replace: true });
      });
    } else {
      navigate('/login', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: 40, textAlign: 'center' }}>Signing you in…</div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/feed"
          element={
            <ProtectedRoute>
              <FeedPage />
            </ProtectedRoute>
          }
        />
        <Route path="/auth/callback" element={<OAuthCallback />} />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
