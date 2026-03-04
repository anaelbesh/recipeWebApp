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
import { ProfilePage } from '../pages/ProfilePage';
import { ProtectedRoute } from './ProtectedRoute';
import { tokenStorage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ChatPage } from '../components/Chat';

// TODO - implement feedPage
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
      // Build the user directly from query params — no JWT decode needed
      const userId = params.get('userId');
      const username = params.get('username');
      const email = params.get('email');
      const profilePicture = params.get('profilePicture') ?? undefined;
      if (userId && username && email) {
        const u = { id: userId, username, email, profilePicture };
        setUser(u);
      }
      navigate('/profile', { replace: true });
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
