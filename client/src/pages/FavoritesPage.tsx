// TODO(BE): implement favorites endpoints:
//   GET    /api/favorites          → list user's favorited recipes
//   POST   /api/favorites/:id      → add recipe to favorites
//   DELETE /api/favorites/:id      → remove recipe from favorites

import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../routes/routes';
import styles from './FavoritesPage.module.css';

export function FavoritesPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h2 className={styles.title}>Favorites</h2>
          <p className={styles.body}>
            Please <Link to={ROUTES.LOGIN}>log in</Link> to see your saved
            recipes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* TODO(BE): remove banner once backend favorites endpoint is live */}
      <div className={styles.pendingBanner}>
        ⚠&nbsp; Backend integration pending — favorites are not yet persisted.
      </div>

      <div className={styles.header}>
        <h1 className={styles.title}>Favorites</h1>
      </div>

      {/* TODO(BE): replace empty state with real favorites fetched from API */}
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>🤍</span>
        <p className={styles.emptyTitle}>No favorites yet</p>
        <p className={styles.emptyBody}>
          Browse recipes and save the ones you love.
        </p>
        <Link to={ROUTES.RECIPES} className={styles.browseLink}>
          Browse Recipes →
        </Link>
      </div>
    </div>
  );
}
