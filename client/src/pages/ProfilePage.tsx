import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { recipesApi } from '../api/recipes';
import type { Recipe } from '../types/recipe';
import { AvatarUploader } from '../components/profile/AvatarUploader';
import { RecipeCard } from '../components/recipe/RecipeCard';
import { EditProfileModal } from '../components/profile/EditProfileModal';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import styles from './ProfilePage.module.css';

const LIMIT = 6;

export function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [recipesError, setRecipesError] = useState('');
  const [showEdit, setShowEdit] = useState(false);

  const handleLikeToggle = async (recipeId: string) => {
    if (!user) return;
    try {
      const response = await recipesApi.toggleLike(recipeId);
      setRecipes((prev) =>
        prev.map((recipe) => {
          if (recipe._id !== recipeId) return recipe;
          const likeCount = recipe.likeCount ?? 0;
          return {
            ...recipe,
            likedByMe: response.liked,
            likeCount: response.liked ? likeCount + 1 : Math.max(0, likeCount - 1),
          };
        })
      );
    } catch {
      // ignore
    }
  };

  const fetchMyRecipes = useCallback(async () => {
    setRecipesLoading(true);
    setRecipesError('');
    try {
      const result = await recipesApi.getMyRecipes({ limit: LIMIT });
      setRecipes(result.items);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Failed to load your recipes.';
      setRecipesError(msg);
    } finally {
      setRecipesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchMyRecipes();
  }, [user, fetchMyRecipes]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className={styles.page}>
      {/* ── Profile header ── */}
      <header className={styles.header}>
        <AvatarUploader
          src={user.profilePicture || undefined}
          username={user.username}
          editable={false}
          size={96}
        />

        <div className={styles.info}>
          <h1 className={styles.username}>{user.username}</h1>
          <p className={styles.email}>{user.email}</p>
          <div className={styles.headerActions}>
            <Button variant="secondary" onClick={() => setShowEdit(true)}>
              Edit Profile
            </Button>
          </div>
        </div>
      </header>

      {/* ── My Recipes section ── */}
      <section className={styles.recipesSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>My Recipes</h2>
          <Link to="/recipes/new" className={styles.addLink}>
            + Add Recipe
          </Link>
        </div>

        {/* Loading */}
        {recipesLoading && (
          <div className={styles.grid}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={200} borderRadius={12} />
            ))}
          </div>
        )}

        {/* Error */}
        {!recipesLoading && recipesError && (
          <div className={styles.errorBox}>
            <p className={styles.errorText}>{recipesError}</p>
            <Button variant="secondary" onClick={fetchMyRecipes}>
              Retry
            </Button>
          </div>
        )}

        {/* Empty */}
        {!recipesLoading && !recipesError && recipes.length === 0 && (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>
              You haven&apos;t added any recipes yet.
            </p>
            <Button onClick={() => navigate('/recipes/new')}>
              + Add your first recipe
            </Button>
          </div>
        )}

        {/* Recipe grid */}
        {!recipesLoading && !recipesError && recipes.length > 0 && (
          <div className={styles.grid}>
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe._id}
                recipe={recipe}
                onDeleted={(id) => setRecipes((prev) => prev.filter((r) => r._id !== id))}
                onLike={handleLikeToggle}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Logout ── */}
      <div className={styles.logoutRow}>
        <Button variant="danger" onClick={handleLogout}>
          Logout
        </Button>
      </div>

      {showEdit && <EditProfileModal onClose={() => setShowEdit(false)} />}
    </div>
  );
}
