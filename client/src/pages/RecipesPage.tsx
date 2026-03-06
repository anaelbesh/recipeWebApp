import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { recipesApi } from '../api/recipes';
import type { Recipe } from '../types/recipe';
import { RecipeCard } from '../components/recipe/RecipeCard';
import { Pagination } from '../components/Pagination';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import styles from './RecipesPage.module.css';

const LIMIT = 9;

export function RecipesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // URL is the single source of truth for page + searchTerm
  const page = Number(searchParams.get('page')) || 1;
  const searchTerm = searchParams.get('search') ?? '';

  // Local input state — syncs from URL when URL changes externally (e.g., navbar search)
  const [searchInput, setSearchInput] = useState(searchTerm);

  useEffect(() => {
    setSearchInput(searchTerm);
  }, [searchTerm]);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await recipesApi.getRecipes({
        page,
        limit: LIMIT,
        search: searchTerm || undefined,
      });
      setRecipes(result.items);
      setPages(result.pages);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Failed to load recipes.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const updateParams = (newPage: number, newSearch: string) => {
    const params: Record<string, string> = { page: String(newPage) };
    if (newSearch) params.search = newSearch;
    setSearchParams(params, { replace: true });
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateParams(1, searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    updateParams(1, '');
  };

  const handlePageChange = (newPage: number) => {
    updateParams(newPage, searchTerm);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {searchTerm && (
          <Button type="button" variant="secondary" onClick={handleClearSearch}>
            Clear
          </Button>
        )}
      </form>

      {/* ── Error state ── */}
      {error && (
        <div className={styles.errorBox}>
          <p className={styles.errorText}>{error}</p>
          <Button variant="secondary" onClick={fetchRecipes}>
            Retry
          </Button>
        </div>
      )}

      {/* ── Loading state ── */}
      {loading && (
        <div className={styles.grid}>
          {Array.from({ length: LIMIT }).map((_, i) => (
            <Skeleton key={i} height={240} borderRadius={12} />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && recipes.length === 0 && (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>
            {searchTerm
              ? `No recipes found for "${searchTerm}".`
              : 'No recipes yet. Be the first to add one!'}
          </p>
          {searchTerm && (
            <Button variant="secondary" onClick={handleClearSearch}>
              Clear search
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
      {!loading && !error && recipes.length > 0 && (
        <div className={styles.grid}>
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe._id}
              recipe={recipe}
              onDeleted={(id) => setRecipes((prev) => prev.filter((r) => r._id !== id))}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {!loading && !error && (
        <Pagination page={page} pages={pages} onPageChange={handlePageChange} />
      )}
    </div>
  );
}
