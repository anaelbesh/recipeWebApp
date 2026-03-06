import type { Recipe } from '../../types/recipe';
import styles from './RecipeCard.module.css';

interface RecipeCardProps {
  recipe: Recipe;
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const creator =
    typeof recipe.createdBy === 'object' ? recipe.createdBy.username : '';
  const snippet =
    recipe.instructions.length > 130
      ? recipe.instructions.slice(0, 130) + '…'
      : recipe.instructions;

  return (
    <div className={styles.card}>
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
        <p className={styles.snippet}>{snippet}</p>
        {recipe.ingredients.length > 0 && (
          <p className={styles.ingredients}>
            {recipe.ingredients.slice(0, 4).join(', ')}
            {recipe.ingredients.length > 4 ? '…' : ''}
          </p>
        )}
        {creator && <p className={styles.creator}>by {creator}</p>}
      </div>
    </div>
  );
}
