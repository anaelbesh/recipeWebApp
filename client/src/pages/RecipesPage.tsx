import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { recipesApi } from '../api/recipes';
import type { Recipe } from '../types/recipe';
import { RecipeCard } from '../components/recipe/RecipeCard';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { RECIPE_CATEGORY_FILTER_OPTIONS } from '../constants/recipeCategories';
import styles from './RecipesPage.module.css';

const LIMIT = 10;

export function RecipesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // URL is source of truth for search + category (page is now internal)
  const searchTerm = searchParams.get('search') ?? '';
  const category = searchParams.get('category') ?? 'All';

  // Local input state — syncs from URL when URL changes externally (e.g., navbar search)
  const [searchInput, setSearchInput] = useState(searchTerm);
  const [categoryInput, setCategoryInput] = useState(category);

  useEffect(() => {
    setSearchInput(searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    setCategoryInput(category);
  }, [category]);

  // Infinite scroll state
  const [items, setItems] = useState<Recipe[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  // Refs to avoid stale closures in IntersectionObserver
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);
  const pageRef = useRef(1);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const extractError = (err: unknown) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'Failed to load recipes.';

  // Initial fetch (page 1) — runs when search/category filters change
  const fetchInitial = useCallback(async () => {
    setLoadingInitial(true);
    setError(null);
    setLoadMoreError(null);
    setItems([]);
    setPage(1);
    setHasMore(true);
    pageRef.current = 1;
    hasMoreRef.current = true;
    loadingMoreRef.current = false;

    try {
      const result = await recipesApi.getRecipes({
        page: 1,
        limit: LIMIT,
        search: searchTerm || undefined,
        category: category !== 'All' ? category : undefined,
      });
      setItems(result.items);
      const more = result.items.length === LIMIT && result.page < result.pages;
      setHasMore(more);
      hasMoreRef.current = more;
      pageRef.current = 1;
    } catch (err: unknown) {
      setError(extractError(err));
    } finally {
      setLoadingInitial(false);
    }
  }, [searchTerm, category]);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  // Load next page and append
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);

    const nextPage = pageRef.current + 1;
    try {
      const result = await recipesApi.getRecipes({
        page: nextPage,
        limit: LIMIT,
        search: searchTerm || undefined,
        category: category !== 'All' ? category : undefined,
      });
      setItems((prev) => {
        const existingIds = new Set(prev.map((r) => r._id));
        const fresh = result.items.filter((r) => !existingIds.has(r._id));
        return [...prev, ...fresh];
      });
      const more = result.items.length === LIMIT && result.page < result.pages;
      setHasMore(more);
      hasMoreRef.current = more;
      setPage(nextPage);
      pageRef.current = nextPage;
    } catch (err: unknown) {
      setLoadMoreError(extractError(err));
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [searchTerm, category]);

  // IntersectionObserver: trigger loadMore when sentinel is visible
  useEffect(() => {
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
  }, [loadMore]);

  const updateParams = (newSearch: string, newCategory: string) => {
    const params: Record<string, string> = {};
    if (newSearch) params.search = newSearch;
    if (newCategory && newCategory !== 'All') params.category = newCategory;
    setSearchParams(params, { replace: true });
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateParams(searchInput, categoryInput);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setCategoryInput('All');
    updateParams('', 'All');
  };

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <h1 className={styles.title}>Recipes</h1>
        {user && (
          <div className={styles.headerActions}>
            <Button onClick={() => navigate('/recipes/new')}>
              + Add Recipe
            </Button>
          </div>
        )}
      </div>

      {/* ── Search ── */}
      <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
        <input
          type="text"
          className={styles.searchInput}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search recipes…"
          aria-label="Search recipes"
        />
        <select
          className={styles.categorySelect}
          value={categoryInput}
          onChange={(e) => {
            setCategoryInput(e.target.value);
            updateParams(searchInput, e.target.value);
          }}
          aria-label="Filter by category"
        >
          {RECIPE_CATEGORY_FILTER_OPTIONS.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {(searchTerm || category !== 'All') && (
          <Button type="button" variant="secondary" onClick={handleClearFilters}>
            Clear
          </Button>
        )}
      </form>

      {/* ── Initial error state ── */}
      {error && (
        <div className={styles.errorBox}>
          <p className={styles.errorText}>{error}</p>
          <Button variant="secondary" onClick={fetchInitial}>
            Retry
          </Button>
        </div>
      )}

      {/* ── Initial loading skeletons ── */}
      {loadingInitial && (
        <div className={styles.grid}>
          {Array.from({ length: LIMIT }).map((_, i) => (
            <Skeleton key={i} height={240} borderRadius={12} />
          ))}
        </div>
      )}

      {/* ── Empty state (first fetch returned 0) ── */}
      {!loadingInitial && !error && items.length === 0 && (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>
            {searchTerm || category !== 'All'
              ? `No recipes found${category !== 'All' ? ` in "${category}"` : ''}${searchTerm ? ` for "${searchTerm}"` : ''}.`
              : 'No recipes yet. Be the first to add one!'}
          </p>
          {(searchTerm || category !== 'All') && (
            <Button variant="secondary" onClick={handleClearFilters}>
              Clear filters
            </Button>
          )}
          {!searchTerm && user && (
            <Button onClick={() => navigate('/recipes/new')}>
              + Add Recipe
            </Button>
          )}
        </div>
      )}

      {/* ── Recipe grid ── */}
      {!loadingInitial && items.length > 0 && (
        <div className={styles.grid}>
          {items.map((recipe) => (
            <RecipeCard
              key={recipe._id}
              recipe={recipe}
              onDeleted={(id) => setItems((prev) => prev.filter((r) => r._id !== id))}
            />
          ))}
        </div>
      )}

      {/* ── Bottom states: spinner / load-more error / end message ── */}
      {!loadingInitial && !error && (
        <>
          {loadingMore && (
            <div className={styles.loadingMore}>
              <span className={styles.spinner} aria-label="Loading more recipes" />
            </div>
          )}

          {loadMoreError && (
            <div className={styles.loadMoreError}>
              <p className={styles.errorText}>{loadMoreError}</p>
              <Button variant="secondary" onClick={loadMore}>
                Retry
              </Button>
            </div>
          )}

          {!hasMore && items.length > 0 && !loadMoreError && (
            <p className={styles.noMore}>No more recipes</p>
          )}

          {/* Sentinel: IntersectionObserver watches this element */}
          <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
        </>
      )}
    </div>
  );
}
