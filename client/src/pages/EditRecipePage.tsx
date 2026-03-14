import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { recipesApi } from '../api/recipes';
import type { Recipe } from '../types/recipe';
import { RecipeForm, type RecipeFormValues } from '../components/recipe/RecipeForm';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import styles from './EditRecipePage.module.css';

function getOwnerId(createdBy: Recipe['createdBy']): string {
  if (typeof createdBy === 'string') return createdBy;
  return String((createdBy as { _id: unknown })._id);
}

export function EditRecipePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    // Wait for auth to finish before fetching, so ownership check has the real user
    if (!id || authLoading) return;
    setFetchLoading(true);
    setFetchError('');
    recipesApi
      .getRecipeById(id)
      .then((r) => {
        // Front-end ownership check — backend enforces too
        if (user && String(getOwnerId(r.createdBy)) !== String(user.id)) {
          setFetchError('You can only edit your own recipes.');
        } else {
          setRecipe(r);
        }
      })
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) setFetchError('Recipe not found.');
        else setFetchError('Failed to load recipe.');
      })
      .finally(() => setFetchLoading(false));
  }, [id, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (values: RecipeFormValues) => {
    if (!id) return;
    setIsSubmitting(true);
    setFormError('');
    try {
      const ingredientList = values.ingredients
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await recipesApi.updateRecipe(id, {
        title: values.title.trim(),
        instructions: values.instructions.trim(),
        ingredients: ingredientList.length ? ingredientList : [],
        imageUrl: values.imageUrl.trim() || undefined,
        category: values.category,
        kosherType:    values.kosherType    || undefined,
        cookingMethod: values.cookingMethod || undefined,
        dishType:      values.dishType      || undefined,
      });

      setSuccessMsg('Recipe updated! Redirecting…');
      setTimeout(() => navigate(`/recipes/${id}`), 1500);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) setFormError('Please log in to edit this recipe.');
      else if (status === 403) setFormError('You can only edit your own recipes.');
      else if (status === 404) setFormError('Recipe not found.');
      else {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? 'Failed to update recipe. Please try again.';
        setFormError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show skeleton while auth OR recipe is still loading
  if (authLoading || fetchLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <Skeleton height={32} borderRadius={8} />
          <Skeleton height={48} borderRadius={8} />
          <Skeleton height={120} borderRadius={8} />
          <Skeleton height={80} borderRadius={8} />
        </div>
      </div>
    );
  }

  // Not logged in (only reached after auth has fully resolved)
  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h2 className={styles.title}>Edit Recipe</h2>
          <p>
            Please <Link to="/login">log in</Link> to edit a recipe.
          </p>
          <Button variant="secondary" onClick={() => navigate('/recipes')}>
            ← Back to Recipes
          </Button>
        </div>
      </div>
    );
  }

  if (fetchError || !recipe) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p className={styles.errorText}>{fetchError || 'Recipe not found.'}</p>
          <Button variant="secondary" onClick={() => navigate('/recipes')}>
            ← Back to Recipes
          </Button>
        </div>
      </div>
    );
  }

  const initialValues: RecipeFormValues = {
    title: recipe.title,
    instructions: recipe.instructions,
    ingredients: recipe.ingredients.join(', '),
    imageUrl: recipe.imageUrl ?? '',
    category: recipe.category || 'Other',
    kosherType:    recipe.kosherType    ?? 'Parve',
    cookingMethod: recipe.cookingMethod ?? 'Pan',
    dishType:      recipe.dishType      ?? 'Main',
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <button
            className={styles.backLink}
            onClick={() => navigate(`/recipes/${id}`)}
          >
            ← Back to Recipe
          </button>
          <h1 className={styles.title}>Edit Recipe</h1>
        </div>

        <RecipeForm
          initialValues={initialValues}
          submitLabel="Save Changes"
          successMessage={successMsg}
          isLoading={isSubmitting}
          formError={formError}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/recipes/${id}`)}
        />
      </div>
    </div>
  );
}
