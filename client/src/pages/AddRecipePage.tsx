import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { recipesApi } from '../api/recipes';
import { RECIPE_CATEGORIES } from '../constants/recipeCategories';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { FormError } from '../components/ui/FormError';
import styles from './AddRecipePage.module.css';

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function AddRecipePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [category, setCategory] = useState<string>(RECIPE_CATEGORIES[0]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [imgBroken, setImgBroken] = useState(false);

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title is required';
    else if (title.trim().length < 3)
      e.title = 'Title must be at least 3 characters';

    if (!instructions.trim()) e.instructions = 'Instructions are required';
    else if (instructions.trim().length < 10)
      e.instructions = 'Instructions must be at least 10 characters';

    if (imageUrl.trim() && !isValidUrl(imageUrl.trim()))
      e.imageUrl = 'Must be a valid URL';

    if (!category) e.category = 'Category is required';

    return e;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setFormError('');
    setIsLoading(true);

    try {
      const ingredientList = ingredients
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await recipesApi.createRecipe({
        title: title.trim(),
        instructions: instructions.trim(),
        ingredients: ingredientList.length ? ingredientList : undefined,
        imageUrl: imageUrl.trim() || undefined,
        category,
      });

      setSuccessMsg('Recipe created! Redirecting…');
      setTimeout(() => navigate('/recipes'), 1500);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Failed to create recipe. Please try again.';
      setFormError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Not logged in — show friendly message instead of redirect
  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.notLoggedIn}>
          <h2>Add a Recipe</h2>
          <p>
            Please <Link to="/login">log in</Link> to add a recipe.
          </p>
          <Button variant="secondary" onClick={() => navigate('/recipes')}>
            ← Back to Recipes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <button
            className={styles.backLink}
            onClick={() => navigate('/recipes')}
          >
            ← Recipes
          </button>
          <h1 className={styles.title}>Add a Recipe</h1>
        </div>

        {successMsg && <div className={styles.success}>{successMsg}</div>}

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <FormError message={formError} />

          <Input
            id="title"
            label="Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            placeholder="e.g. Spaghetti Carbonara"
          />

          <div className={styles.fieldWrapper}>
            <label htmlFor="category" className={styles.label}>
              Category *
            </label>
            <select
              id="category"
              className={`${styles.textarea} ${errors.category ? styles.textareaError : ''}`}
              style={{ resize: 'none', cursor: 'pointer' }}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {RECIPE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {errors.category && (
              <span className={styles.fieldError}>{errors.category}</span>
            )}
          </div>

          <div className={styles.fieldWrapper}>
            <label htmlFor="instructions" className={styles.label}>
              Instructions *
            </label>
            <textarea
              id="instructions"
              className={`${styles.textarea} ${errors.instructions ? styles.textareaError : ''}`}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Step-by-step instructions…"
              rows={6}
            />
            {errors.instructions && (
              <span className={styles.fieldError}>{errors.instructions}</span>
            )}
          </div>

          <div className={styles.fieldWrapper}>
            <label htmlFor="ingredients" className={styles.label}>
              Ingredients{' '}
              <span className={styles.hint}>(comma-separated, optional)</span>
            </label>
            <textarea
              id="ingredients"
              className={styles.textarea}
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder="e.g. pasta, eggs, pancetta, parmesan"
              rows={3}
            />
          </div>

          <Input
            id="imageUrl"
            label="Image URL (optional)"
            value={imageUrl}
            onChange={(e) => {
              setImageUrl(e.target.value);
              setImgBroken(false);
            }}
            error={errors.imageUrl}
            placeholder="https://example.com/photo.jpg"
          />

          {/* Image preview */}
          {imageUrl.trim() && !errors.imageUrl && (
            <div className={styles.previewBox}>
              {imgBroken ? (
                <p className={styles.previewError}>
                  ⚠ Could not load image preview.
                </p>
              ) : (
                <img
                  src={imageUrl}
                  alt="Recipe preview"
                  className={styles.preview}
                  onError={() => setImgBroken(true)}
                />
              )}
            </div>
          )}

          <div className={styles.actions}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/recipes')}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Create Recipe
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
