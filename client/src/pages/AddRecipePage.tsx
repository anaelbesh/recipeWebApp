import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { recipesApi } from '../api/recipes';
import { RecipeForm, type RecipeFormValues } from '../components/recipe/RecipeForm';
import { Button } from '../components/ui/Button';
import styles from './AddRecipePage.module.css';

export function AddRecipePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (values: RecipeFormValues) => {
    setFormError('');
    setIsLoading(true);

    try {
      const ingredientList = values.ingredients
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await recipesApi.createRecipe({
        title: values.title.trim(),
        instructions: values.instructions.trim(),
        ingredients: ingredientList.length ? ingredientList : undefined,
        imageUrl: values.imageUrl.trim() || undefined,
        category: values.category,
        kosherType: values.kosherType,
        cookingMethod: values.cookingMethod,
        dishType: values.dishType,
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

        <RecipeForm
          submitLabel="Create Recipe"
          successMessage={successMsg}
          isLoading={isLoading}
          formError={formError}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/recipes')}
        />
      </div>
    </div>
  );
}
