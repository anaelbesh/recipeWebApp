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
const RECIPES_SCROLL_STATE_KEY = 'recipesScrollRestore';

interface ScrollRestoreState {
  y: number;
  cursor: string | null;
  page: number;
  category: string;
  query: string;
  ts: number;
}

export function RecipesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // URL is source of truth for normal search + category (page is now internal)
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

  // ── Normal-search state (infinite scroll) ──────────────────────────────────
  const [items, setItems] = useState<Recipe[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const handleLikeToggle = async (recipeId: string) => {
    if (!user) return;
    try {
      const response = await recipesApi.toggleLike(recipeId);
      setItems((prev) =>
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

  // Refs — avoid stale closures in IntersectionObserver and async callbacks
  const loadingMoreRef    = useRef(false);
  const hasMoreRef        = useRef(true);
  const restoreStateRef = useRef<ScrollRestoreState | null>(null);
  const restoredRef = useRef(false);
  // Cursor for cursor-based pagination (non-search). null = first page.
  const cursorRef         = useRef<string | null>(null);
  // Page number for legacy skip-based pagination (text-search results).
  const pageRef           = useRef(1);
  // True while fetchInitial is in flight — prevents loadMore from running concurrently.
  const fetchingInitialRef = useRef(false);
  const sentinelRef       = useRef<HTMLDivElement | null>(null);

  const extractError = (err: unknown) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'Failed to load recipes.';

  // ── Normal search: initial fetch (first page) ──────────────────────────────
  const fetchInitial = useCallback(async () => {
    fetchingInitialRef.current = true;
    setLoadingInitial(true);
    setError(null);
    setLoadMoreError(null);
    setItems([]);
    setHasMore(true);
    // Reset both pagination cursors
    cursorRef.current  = null;
    pageRef.current    = 1;
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
      setHasMore(result.hasMore);
      hasMoreRef.current = result.hasMore;
      // Save cursor for non-search infinite scroll
      cursorRef.current = result.nextCursor ?? null;
      pageRef.current   = 1;
    } catch (err: unknown) {
      setError(extractError(err));
    } finally {
      setLoadingInitial(false);
      fetchingInitialRef.current = false;
    }
  }, [searchTerm, category]);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  useEffect(() => {
    const saved = sessionStorage.getItem(RECIPES_SCROLL_STATE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as ScrollRestoreState;
      const isFresh = Date.now() - parsed.ts < 5 * 60 * 1000;
      if (isFresh && parsed.category === category && parsed.query === searchTerm) {
        restoreStateRef.current = parsed;
        restoredRef.current = false;
      } else {
        sessionStorage.removeItem(RECIPES_SCROLL_STATE_KEY);
      }
    } catch {
      sessionStorage.removeItem(RECIPES_SCROLL_STATE_KEY);
    }
  }, [category, searchTerm]);

  // ── Normal search: load next page and append ────────────────────────────────
  const loadMore = useCallback(async () => {
    // Guard: skip if already loading, nothing more to load, or initial fetch is in flight.
    if (loadingMoreRef.current || !hasMoreRef.current || fetchingInitialRef.current) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);

    try {
      let result;
      if (searchTerm) {
        // Text-search results: use legacy page-based pagination (cursor not supported).
        const nextPage = pageRef.current + 1;
        result = await recipesApi.getRecipes({
          page: nextPage,
          limit: LIMIT,
          search: searchTerm,
          category: category !== 'All' ? category : undefined,
        });
        pageRef.current = nextPage;
      } else {
        // Normal results: cursor-based — no skip drift, no missing items.
        result = await recipesApi.getRecipes({
          cursor: cursorRef.current ?? undefined,
          limit: LIMIT,
          category: category !== 'All' ? category : undefined,
        });
        cursorRef.current = result.nextCursor ?? null;
      }

      setItems((prev) => {
        const existingIds = new Set(prev.map((r) => r._id));
        const fresh = result.items.filter((r) => !existingIds.has(r._id));
        return [...prev, ...fresh];
      });
      setHasMore(result.hasMore);
      hasMoreRef.current = result.hasMore;
    } catch (err: unknown) {
      setLoadMoreError(extractError(err));
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [searchTerm, category]);

  useEffect(() => {
    if (loadingInitial || loadingMore || !hasMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const rect = sentinel.getBoundingClientRect();
    if (rect.top <= window.innerHeight + 200) {
      void loadMore();
    }
  }, [items.length, loadingInitial, loadingMore, hasMore, loadMore]);

  const maybeRestoreScroll = useCallback(async () => {
    const restore = restoreStateRef.current;
    if (!restore || restoredRef.current || loadingInitial) return;
    const targetHeight = restore.y + window.innerHeight;
    if (document.body.scrollHeight >= targetHeight || !hasMoreRef.current) {
      requestAnimationFrame(() => window.scrollTo(0, restore.y));
      restoredRef.current = true;
      restoreStateRef.current = null;
      sessionStorage.removeItem(RECIPES_SCROLL_STATE_KEY);
      return;
    }
    if (hasMoreRef.current && !loadingMoreRef.current) {
      await loadMore();
    }
  }, [loadMore, loadingInitial]);

  useEffect(() => {
    void maybeRestoreScroll();
  }, [items.length, maybeRestoreScroll]);

  // IntersectionObserver: trigger loadMore when sentinel is visible.
  // IMPORTANT: `loadingInitial` is in the dep array so the observer re-attaches
  // to the freshly-mounted sentinel after each initial fetch (the sentinel is
  // conditionally rendered, so its DOM node is replaced on every show/hide cycle).
  useEffect(() => {
    if (loadingInitial) return; // sentinel is not in DOM during initial load
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

  const handleRecipeSelect = (recipeId: string) => {
    const payload: ScrollRestoreState = {
      y: window.scrollY,
      cursor: cursorRef.current,
      page: pageRef.current,
      category,
      query: searchTerm,
      ts: Date.now(),
    };
    sessionStorage.setItem(RECIPES_SCROLL_STATE_KEY, JSON.stringify(payload));
    navigate(`/recipes/${recipeId}`, { state: { from: 'recipes' } });
  };

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
        <div className={styles.headerActions}>
          {user && (
            <Button onClick={() => navigate('/recipes/new')}>
              + Add Recipe
            </Button>
          )}
        </div>
      </div>

      {/* ── Search form ── */}
      <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
          <input
            type="text"
            className={styles.searchInput}
            value={searchInput}
            onChange={(e) => {
              const next = e.target.value;
              setSearchInput(next);
              if (!next.trim() && searchTerm) {
                updateParams('', categoryInput);
              }
            }}
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

      {error && (
        <div className={styles.errorBox}>
          <p className={styles.errorText}>{error}</p>
          <Button variant="secondary" onClick={fetchInitial}>
            Retry
          </Button>
        </div>
      )}

      {loadingInitial && (
        <div className={styles.grid}>
          {Array.from({ length: LIMIT }).map((_, i) => (
            <Skeleton key={i} height={240} borderRadius={12} />
          ))}
        </div>
      )}

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

      {!loadingInitial && items.length > 0 && (
        <div className={styles.grid}>
          {items.map((recipe) => (
            <RecipeCard
              key={recipe._id}
              recipe={recipe}
              onSelect={handleRecipeSelect}
              onDeleted={(id) => setItems((prev) => prev.filter((r) => r._id !== id))}
              onLike={handleLikeToggle}
            />
          ))}
        </div>
      )}

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

          {hasMore && !loadingMore && !loadMoreError && items.length > 0 && (
            <div className={styles.loadMoreButtonRow}>
              <Button variant="secondary" onClick={() => void loadMore()}>
                Load more
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
