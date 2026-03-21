import { useEffect, useState, useCallback, useRef } from 'react';
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

const LIMIT = 12; // Items per page

export function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // ── Main data state ────────────────────────────────────────────
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  // ── Pagination refs (avoid stale closures) ────────────────────
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const cursorRef = useRef<string | null>(null);
  const fetchingInitialRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const extractError = (err: unknown) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'Failed to load recipes.';

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

  // ── Initial fetch (first page of recipes) ──────────────────────
  const fetchInitial = useCallback(async () => {
    fetchingInitialRef.current = true;
    setLoadingInitial(true);
    setError(null);
    setLoadMoreError(null);
    setRecipes([]);
    cursorRef.current = null;
    hasMoreRef.current = true;
    loadingMoreRef.current = false;

    try {
      const result = await recipesApi.getMyRecipes({ limit: LIMIT });
      setRecipes(result.items);
      hasMoreRef.current = result.hasMore;
      cursorRef.current = result.nextCursor ?? null;

      console.log(
        `[ProfilePage] Initial fetch: ${result.items.length} recipes | Total: ${result.total} | Has more: ${result.hasMore}`,
      );
    } catch (err: unknown) {
      const msg = extractError(err);
      setError(msg);
      console.error('[ProfilePage] Error fetching initial recipes:', msg);
    } finally {
      setLoadingInitial(false);
      fetchingInitialRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchInitial();
  }, [user, fetchInitial]);

  // ── Load more recipes (append to list) ─────────────────────────
  const loadMore = useCallback(async () => {
    // Guard: skip if already loading, nothing more to load, or initial fetch is in flight
    if (loadingMoreRef.current || !hasMoreRef.current || fetchingInitialRef.current) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);

    try {
      // Use cursor-based pagination (same as main RecipesPage)
      const result = await recipesApi.getMyRecipes({
        cursor: cursorRef.current ?? undefined,
        limit: LIMIT,
      });

      setRecipes((prev) => {
        // Dedup by _id to avoid showing same recipe twice
        const existingIds = new Set(prev.map((r) => r._id));
        const fresh = result.items.filter((r) => !existingIds.has(r._id));
        return [...prev, ...fresh];
      });

      hasMoreRef.current = result.hasMore;
      cursorRef.current = result.nextCursor ?? null;

      console.log(
        `[ProfilePage] Load more: fetched ${result.items.length} recipes | Has more: ${result.hasMore} | New total: ${recipes.length + result.items.length}`,
      );
    } catch (err: unknown) {
      const msg = extractError(err);
      setLoadMoreError(msg);
      console.error('[ProfilePage] Error loading more recipes:', msg);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [recipes.length]);

  // ── IntersectionObserver: trigger loadMore when sentinel is visible ─────
  useEffect(() => {
    if (loadingInitial) return; // sentinel not in DOM during initial load
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, loadingInitial]);

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

        {/* Initial loading skeleton */}
        {loadingInitial && (
          <div className={styles.grid}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={200} borderRadius={12} />
            ))}
          </div>
        )}

        {/* Initial error */}
        {!loadingInitial && error && (
          <div className={styles.errorBox}>
            <p className={styles.errorText}>{error}</p>
            <Button variant="secondary" onClick={fetchInitial}>
              Retry
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!loadingInitial && !error && recipes.length === 0 && (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>
              You haven&apos;t added any recipes yet.
            </p>
            <Button onClick={() => navigate('/recipes/new')}>
              + Add your first recipe
            </Button>
          </div>
        )}

        {/* Recipe grid (infinite scroll) */}
        {!loadingInitial && !error && recipes.length > 0 && (
          <>
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

            {/* Loading more indicator */}
            {loadingMore && (
              <div className={styles.loadingMore}>
                <span className={styles.spinner} aria-label="Loading more recipes" />
              </div>
            )}

            {/* Load more error */}
            {loadMoreError && (
              <div className={styles.loadMoreError}>
                <p className={styles.errorText}>{loadMoreError}</p>
                <Button variant="secondary" onClick={loadMore}>
                  Retry
                </Button>
              </div>
            )}

            {/* No more recipes message */}
            {!hasMoreRef.current && recipes.length > 0 && !loadMoreError && (
              <p className={styles.noMore}>No more recipes</p>
            )}

            {/* Sentinel: IntersectionObserver watches this element */}
            <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
          </>
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
