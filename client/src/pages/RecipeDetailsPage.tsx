import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { recipesApi } from '../api/recipes';
import type { Recipe } from '../types/recipe';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import styles from './RecipeDetailsPage.module.css';

/**
 * Returns true if the logged-in user is the owner of the recipe.
 * Uses String() on both sides to handle ObjectId vs plain-string comparisons.
 */
function checkOwner(userId: string | undefined, createdBy: Recipe['createdBy']): boolean {
  if (!userId) return false;
  const ownerId =
    typeof createdBy === 'string' ? createdBy : String((createdBy as { _id: unknown })._id);
  return String(ownerId) === String(userId);
}

export function RecipeDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    recipesApi
      .getRecipeById(id)
      .then(setRecipe)
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) setError('Recipe not found.');
        else setError('Failed to load recipe.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await recipesApi.deleteRecipe(id);
      navigate('/recipes', { replace: true });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) setDeleteError('Please log in to delete this recipe.');
      else if (status === 403) setDeleteError('You can only delete your own recipes.');
      else if (status === 404) setDeleteError('Recipe not found — it may already be deleted.');
      else setDeleteError('Failed to delete recipe. Please try again.');
      setShowConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <Skeleton height={320} borderRadius={12} />
          <Skeleton height={32} borderRadius={8} />
          <Skeleton height={120} borderRadius={8} />
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <p className={styles.errorText}>{error || 'Recipe not found.'}</p>
          <Button variant="secondary" onClick={() => navigate('/recipes')}>
            ← Back to Recipes
          </Button>
        </div>
      </div>
    );
  }

  const isOwner = checkOwner(user?.id, recipe.createdBy);
  const creatorName =
    typeof recipe.createdBy === 'object' ? recipe.createdBy.username : '';

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Back */}
        <button className={styles.backLink} onClick={() => navigate('/recipes')}>
          ← Back to Recipes
        </button>

        {/* Layout: image + details */}
        <div className={styles.layout}>
          {recipe.imageUrl && (
            <div className={styles.imageWrapper}>
              <img
                src={recipe.imageUrl}
                alt={recipe.title}
                className={styles.image}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).parentElement!.style.display = 'none';
                }}
              />
            </div>
          )}

          <div className={styles.details}>
            <h1 className={styles.title}>{recipe.title}</h1>
            {creatorName && (
              <p className={styles.creator}>by {creatorName}</p>
            )}

            {recipe.ingredients.length > 0 && (
              <div className={styles.section}>
                <h2 className={styles.sectionTitle}>Ingredients</h2>
                <ul className={styles.ingredientList}>
                  {recipe.ingredients.map((ing, i) => (
                    <li key={i} className={styles.ingredientItem}>
                      {ing}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Instructions</h2>
              <p className={styles.instructions}>{recipe.instructions}</p>
            </div>

            {/* Owner actions */}
            {isOwner && (
              <div className={styles.actions}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate(`/recipes/${recipe._id}/edit`)}
                >
                  Edit Recipe
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setShowConfirm(true)}
                  disabled={isDeleting}
                >
                  Delete Recipe
                </Button>
              </div>
            )}

            {deleteError && (
              <p className={styles.deleteError}>{deleteError}</p>
            )}
          </div>
        </div>

        {/* Confirmation dialog */}
        {showConfirm && (
          <div className={styles.overlay}>
            <div className={styles.dialog}>
              <h3 className={styles.dialogTitle}>Delete recipe?</h3>
              <p className={styles.dialogBody}>
                This action cannot be undone. &ldquo;{recipe.title}&rdquo; will be permanently removed.
              </p>
              <div className={styles.dialogActions}>
                <Button
                  variant="secondary"
                  onClick={() => setShowConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  isLoading={isDeleting}
                >
                  Yes, delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
