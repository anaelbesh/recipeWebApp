import { useState, type FormEvent } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { FormError } from '../ui/FormError';
import styles from './RecipeForm.module.css';

export interface RecipeFormValues {
  title: string;
  instructions: string;
  ingredients: string; // comma-separated string for the textarea
  imageUrl: string;
}

interface RecipeFormProps {
  /** Initial values — pass when editing an existing recipe */
  initialValues?: Partial<RecipeFormValues>;
  submitLabel?: string;
  successMessage?: string;
  isLoading?: boolean;
  formError?: string;
  onSubmit: (values: RecipeFormValues) => void;
  onCancel: () => void;
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function RecipeForm({
  initialValues = {},
  submitLabel = 'Save',
  successMessage,
  isLoading = false,
  formError,
  onSubmit,
  onCancel,
}: RecipeFormProps) {
  const [title, setTitle] = useState(initialValues.title ?? '');
  const [instructions, setInstructions] = useState(initialValues.instructions ?? '');
  const [ingredients, setIngredients] = useState(initialValues.ingredients ?? '');
  const [imageUrl, setImageUrl] = useState(initialValues.imageUrl ?? '');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imgBroken, setImgBroken] = useState(false);

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title is required';
    else if (title.trim().length < 3) e.title = 'Title must be at least 3 characters';
    if (!instructions.trim()) e.instructions = 'Instructions are required';
    else if (instructions.trim().length < 10)
      e.instructions = 'Instructions must be at least 10 characters';
    if (imageUrl.trim() && !isValidUrl(imageUrl.trim()))
      e.imageUrl = 'Must be a valid URL';
    return e;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    onSubmit({ title, instructions, ingredients, imageUrl });
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      {formError && <FormError message={formError} />}
      {successMessage && <div className={styles.success}>{successMessage}</div>}

      <Input
        id="title"
        label="Title *"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={errors.title}
        placeholder="e.g. Spaghetti Carbonara"
      />

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
            <p className={styles.previewError}>⚠ Could not load image preview.</p>
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
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isLoading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
