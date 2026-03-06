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
import { RecipesPage } from '../pages/RecipesPage';
import { AddRecipePage } from '../pages/AddRecipePage';
import { RecipeDetailsPage } from '../pages/RecipeDetailsPage';
import { EditRecipePage } from '../pages/EditRecipePage';
import { FavoritesPage } from '../pages/FavoritesPage';
import { AppLayout } from '../layout/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { tokenStorage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ChatPage } from '../components/Chat';

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
        {/* ── Auth pages (no navbar) ── */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/callback" element={<OAuthCallback />} />

        {/* ── App shell (navbar + layout) ── */}
        <Route element={<AppLayout />}>
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/recipes/new" element={<AddRecipePage />} />
          <Route path="/recipes/:id" element={<RecipeDetailsPage />} />
          <Route path="/recipes/:id/edit" element={<EditRecipePage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/recipes" replace />} />
          <Route path="*" element={<Navigate to="/recipes" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
