import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Recipe } from '../../types/recipe';
import { useAuth } from '../../context/AuthContext';
import { recipesApi } from '../../api/recipes';
import styles from './RecipeCard.module.css';

interface RecipeCardProps {
  recipe: Recipe;
  onDeleted?: (id: string) => void;
  onSelect?: (id: string) => void;
  onLike?: (id: string) => void;
}

function checkOwner(userId: string | undefined, createdBy: Recipe['createdBy']): boolean {
  if (!userId) return false;
  if (!createdBy) return false;
  const ownerId =
    typeof createdBy === 'string'
      ? createdBy
      : '_id' in createdBy
        ? String(createdBy._id)
        : '';
  return String(ownerId) === String(userId);
}

export function RecipeCard({ recipe, onDeleted, onSelect, onLike }: RecipeCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = checkOwner(user?.id, recipe.createdBy);

  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const likeCount = recipe.likeCount ?? 0;
  const commentCount = recipe.commentCount ?? 0;

  const creator =
    recipe.createdBy &&
    typeof recipe.createdBy === 'object' &&
    'username' in recipe.createdBy
      ? recipe.createdBy.username
      : '';
  const snippet =
    recipe.instructions.length > 130
      ? recipe.instructions.slice(0, 130) + '…'
      : recipe.instructions;

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLike?.(recipe._id);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(true);
    setDeleteError('');
    try {
      await recipesApi.deleteRecipe(recipe._id);
      onDeleted?.(recipe._id);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) setDeleteError('Please log in.');
      else if (status === 403) setDeleteError('Not allowed.');
      else setDeleteError('Failed to delete.');
      setShowConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCardClick = () => {
    if (onSelect) {
      onSelect(recipe._id);
      return;
    }
    navigate(`/recipes/${recipe._id}`, { state: { from: 'recipes' } });
  };

  return (
    <>
      <div
        className={styles.card}
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
        style={{ cursor: 'pointer' }}
      >
        {recipe.imageUrl && (
          <div className={styles.imageWrapper}>
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className={styles.image}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).parentElement!.style.display =
                  'none';
              }}
            />
          </div>
        )}
        <div className={styles.body}>
          <h3 className={styles.title}>{recipe.title}</h3>
          {recipe.category && <span className={styles.category}>{recipe.category}</span>}
          <p className={styles.snippet}>{snippet}</p>
          <div className={styles.statsRow}>
            <button
              type="button"
              className={`${styles.likeButton} ${recipe.likedByMe ? styles.liked : ''}`}
              onClick={handleLikeClick}
              aria-pressed={recipe.likedByMe}
              aria-label={recipe.likedByMe ? 'Unlike recipe' : 'Like recipe'}
            >
              ❤ <span className={styles.statCount}>{likeCount}</span>
            </button>
            <div className={styles.commentCount}>
              💬 <span className={styles.statCount}>{commentCount}</span>
            </div>
          </div>
          {recipe.ingredients.length > 0 && (
            <p className={styles.ingredients}>
              {recipe.ingredients.slice(0, 4).join(', ')}
              {recipe.ingredients.length > 4 ? '…' : ''}
            </p>
          )}
          {creator && <p className={styles.creator}>by {creator}</p>}

          {isOwner && (
            <div className={styles.ownerActions}>
              <button
                className={styles.editBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/recipes/${recipe._id}/edit`);
                }}
                title="Edit recipe"
              >
                Edit
              </button>
              <button
                className={styles.deleteBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteError('');
                  setShowConfirm(true);
                }}
                title="Delete recipe"
              >
                Delete
              </button>
            </div>
          )}
          {deleteError && <p className={styles.deleteError}>{deleteError}</p>}
        </div>
      </div>

      {showConfirm && (
        <div
          className={styles.overlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowConfirm(false);
          }}
        >
          <div className={styles.dialog}>
            <h3 className={styles.dialogTitle}>Delete recipe?</h3>
            <p className={styles.dialogBody}>
              &ldquo;{recipe.title}&rdquo; will be permanently removed.
            </p>
            <div className={styles.dialogActions}>
              <button
                className={styles.cancelBtn}
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className={styles.confirmDeleteBtn}
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
