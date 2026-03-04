import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/ui/Spinner';

/**
 * Wraps a route that requires authentication.
 * Shows a spinner while the auth state is being restored,
 * then redirects to /login if the user is not logged in.
 */
export function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 80 }}>
        <Spinner />
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}
