import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
  const location = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLowResImage, setIsLowResImage] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

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

  /* Handle ESC key to close lightbox */
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxOpen) {
        setLightboxOpen(false);
      }
    };
    if (lightboxOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [lightboxOpen]);

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

  const handleBackClick = () => {
    const cameFromRecipes = location.state?.from === 'recipes';
    if (cameFromRecipes) {
      navigate(-1);
    } else {
      navigate('/recipes');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Back button */}
        <button 
          className={styles.backLink} 
          onClick={handleBackClick}
          aria-label="Go back to recipes list"
        >
          ← Back to Recipes
        </button>

        {/* Main card: hero image + content */}
        <article className={styles.card} role="main">
          {recipe.imageUrl && (
            <button 
              className={styles.heroImageWrapper}
              onClick={() => setLightboxOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setLightboxOpen(true);
                }
              }}
              aria-label={`View full size photo of ${recipe.title}`}
              type="button"
            >
              <img
                src={recipe.imageUrl}
                alt={`Photo of ${recipe.title}`}
                className={`${styles.image} ${isLowResImage ? styles.imageLowRes : ''}`}
                onLoad={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  const ratio = img.naturalWidth / img.naturalHeight;
                  // Use contain mode if image is very small OR has extreme portrait ratio
                  if (img.naturalWidth < 800 || ratio < 0.5) {
                    setIsLowResImage(true);
                  }
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).parentElement!.style.display = 'none';
                }}
              />
            </button>
          )}

          <div className={styles.details}>
            <h1 className={styles.title}>{recipe.title}</h1>
            
            <div className={styles.metadata}>
              {recipe.category && (
                <span className={styles.categoryBadge} aria-label={`Category: ${recipe.category}`}>
                  {recipe.category}
                </span>
              )}
              {creatorName && (
                <p className={styles.creator}>
                  <span aria-label="Recipe creator">by</span> {creatorName}
                </p>
              )}
            </div>

            {recipe.ingredients.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Ingredients</h2>
                <ul className={styles.ingredientList} role="list">
                  {recipe.ingredients.map((ing, i) => (
                    <li key={i} className={styles.ingredientItem} role="listitem">
                      {ing}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Instructions</h2>
              <p className={styles.instructions}>{recipe.instructions}</p>
            </section>

            {/* Owner actions */}
            {isOwner && (
              <div className={styles.actions}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate(`/recipes/${recipe._id}/edit`)}
                  aria-label={`Edit recipe: ${recipe.title}`}
                >
                  Edit Recipe
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setShowConfirm(true)}
                  disabled={isDeleting}
                  aria-label={`Delete recipe: ${recipe.title}`}
                >
                  Delete Recipe
                </Button>
              </div>
            )}

            {deleteError && (
              <div className={styles.deleteError} role="alert">
                {deleteError}
              </div>
            )}
          </div>
        </article>

        {/* Lightbox modal for full-size image */}
        {lightboxOpen && recipe.imageUrl && (
          <div 
            className={styles.lightboxOverlay}
            onClick={() => setLightboxOpen(false)}
            role="presentation"
          >
            <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
              <button
                className={styles.lightboxClose}
                onClick={() => setLightboxOpen(false)}
                aria-label="Close image viewer"
                type="button"
              >
                ✕
              </button>
              <img
                src={recipe.imageUrl}
                alt={`Full size photo of ${recipe.title}`}
                className={styles.lightboxImage}
              />
            </div>
          </div>
        )}

        {/* Confirmation dialog */}
        {showConfirm && (
          <div className={styles.overlay} role="presentation">
            <div 
              className={styles.dialog}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-dialog-title"
              aria-describedby="delete-dialog-body"
            >
              <h2 className={styles.dialogTitle} id="delete-dialog-title">Delete recipe?</h2>
              <p className={styles.dialogBody} id="delete-dialog-body">
                This action cannot be undone. &ldquo;{recipe.title}&rdquo; will be permanently removed.
              </p>
              <div className={styles.dialogActions}>
                <Button
                  variant="secondary"
                  onClick={() => setShowConfirm(false)}
                  disabled={isDeleting}
                  aria-label="Cancel deletion"
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  isLoading={isDeleting}
                  aria-label="Confirm deletion"
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
