import { useState, type FormEvent, useRef } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { FormError } from '../ui/FormError';
import { RECIPE_CATEGORIES } from '../../constants/recipeCategories';
import { recipesApi } from '../../api/recipes';
import styles from './RecipeForm.module.css';

const KOSHER_TYPES = ['Meat', 'Dairy', 'Parve'] as const;
const COOKING_METHODS = ['Grill', 'Oven', 'Pan', 'NoCook', 'Boil', 'Fry'] as const;
const DISH_TYPES = ['Main', 'Side', 'Dessert', 'Snack', 'Spread'] as const;

export interface RecipeFormValues {
  title: string;
  instructions: string;
  ingredients: string; // comma-separated string for the textarea
  imageUrl: string;
  category: string;
  kosherType: string;
  cookingMethod: string;
  dishType: string;
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

function isValidImageUrl(value: string): boolean {
  // Accept server-relative paths for uploaded images
  if (value.startsWith('/uploads/')) return true;
  // Accept absolute HTTP(S) URLs
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

// Detect if a URL is already uploaded (relative path)
function isUploadedImage(url: string): boolean {
  return url.startsWith('/uploads/');
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
  const [category, setCategory] = useState(initialValues.category ?? RECIPE_CATEGORIES[0]);
  const [kosherType, setKosherType] = useState(initialValues.kosherType ?? 'Parve');
  const [cookingMethod, setCookingMethod] = useState(initialValues.cookingMethod ?? 'Pan');
  const [dishType, setDishType] = useState(initialValues.dishType ?? 'Main');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imgBroken, setImgBroken] = useState(false);

  // Image source mode
  const [imageMode, setImageMode] = useState<'upload' | 'url'>(
    initialValues.imageUrl ? (isUploadedImage(initialValues.imageUrl) ? 'upload' : 'url') : 'upload'
  );
  
  // Upload mode state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadResultUrl, setUploadResultUrl] = useState<string>(
    initialValues.imageUrl && isUploadedImage(initialValues.imageUrl) ? initialValues.imageUrl : ''
  );
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL mode state
  const [urlInput, setUrlInput] = useState<string>(
    initialValues.imageUrl && !isUploadedImage(initialValues.imageUrl) ? initialValues.imageUrl : ''
  );
  const [urlError, setUrlError] = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Only JPEG, PNG, and WebP images are allowed');
      return;
    }

    // Validate file size (5MB max)
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setUploadError('File size must be less than 5MB');
      return;
    }

    // Create local preview
    const previewUrl = URL.createObjectURL(file);
    setUploadedFile(file);
    setLocalPreviewUrl(previewUrl);
    setUploadResultUrl(''); // Clear previous upload result

    // Upload the file
    setIsUploading(true);
    try {
      const response = await recipesApi.uploadImage(file);
      setUploadResultUrl(response.imageUrl);
      setLocalPreviewUrl(''); // Clear local preview, use response URL now
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error 
        || 'Failed to upload image';
      setUploadError(errorMsg);
      setUploadedFile(null);
      setLocalPreviewUrl('');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearUpload = () => {
    setUploadedFile(null);
    setUploadResultUrl('');
    setLocalPreviewUrl('');
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleModeChange = (mode: 'upload' | 'url') => {
    setImageMode(mode);
    // Clear errors and states from the other mode
    if (mode === 'upload') {
      setUrlError('');
    } else {
      handleClearUpload();
    }
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title is required';
    else if (title.trim().length < 3) e.title = 'Title must be at least 3 characters';
    if (!instructions.trim()) e.instructions = 'Instructions are required';
    else if (instructions.trim().length < 10)
      e.instructions = 'Instructions must be at least 10 characters';
    
    // Only validate image URL based on current mode
    if (imageMode === 'url' && urlInput.trim()) {
      if (!isValidImageUrl(urlInput.trim())) {
        e.imageUrl = 'Must be a valid URL (http/https only)';
      }
    }
    
    if (!category) e.category = 'Category is required';
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

    // Determine final imageUrl based on mode
    const finalImageUrl = imageMode === 'upload' ? uploadResultUrl : urlInput;
    
    onSubmit({ 
      title, 
      instructions, 
      ingredients, 
      imageUrl: finalImageUrl, 
      category, 
      kosherType, 
      cookingMethod, 
      dishType 
    });
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
        <label htmlFor="category" className={styles.label}>
          Category *
        </label>
        <select
          id="category"
          className={`${styles.select} ${errors.category ? styles.selectError : ''}`}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {RECIPE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        {errors.category && (
          <span className={styles.fieldError}>{errors.category}</span>
        )}
      </div>

      <div className={styles.fieldWrapper}>
        <label htmlFor="kosherType" className={styles.label}>Kosher Type *</label>
        <select
          id="kosherType"
          className={styles.select}
          value={kosherType}
          onChange={(e) => setKosherType(e.target.value)}
        >
          {KOSHER_TYPES.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </div>

      <div className={styles.fieldWrapper}>
        <label htmlFor="cookingMethod" className={styles.label}>Cooking Method *</label>
        <select
          id="cookingMethod"
          className={styles.select}
          value={cookingMethod}
          onChange={(e) => setCookingMethod(e.target.value)}
        >
          {COOKING_METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div className={styles.fieldWrapper}>
        <label htmlFor="dishType" className={styles.label}>Dish Type</label>
        <select
          id="dishType"
          className={styles.select}
          value={dishType}
          onChange={(e) => setDishType(e.target.value)}
        >
          {DISH_TYPES.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
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

      {/* Image mode toggle */}
      <div className={styles.fieldWrapper}>
        <label className={styles.label}>Image Source</label>
        <div className={styles.modeToggle}>
          <button
            type="button"
            className={`${styles.modeButton} ${imageMode === 'upload' ? styles.modeButtonActive : ''}`}
            onClick={() => handleModeChange('upload')}
            disabled={isLoading || isUploading}
          >
            📁 Upload Image
          </button>
          <button
            type="button"
            className={`${styles.modeButton} ${imageMode === 'url' ? styles.modeButtonActive : ''}`}
            onClick={() => handleModeChange('url')}
            disabled={isLoading || isUploading}
          >
            🔗 Image URL
          </button>
        </div>
      </div>

      {/* Upload mode section */}
      {imageMode === 'upload' && (
        <div className={styles.fieldWrapper}>
          <label htmlFor="imageUpload" className={styles.label}>
            Upload Image <span className={styles.hint}>(JPEG, PNG, WebP • max 5MB)</span>
          </label>
          <div className={styles.uploadBox}>
            <input
              ref={fileInputRef}
              type="file"
              id="imageUpload"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              disabled={isUploading || isLoading}
              className={styles.fileInput}
              aria-label="Upload recipe image"
            />
            <label htmlFor="imageUpload" className={styles.uploadButton}>
              {isUploading ? '⏳ Uploading...' : '📁 Choose Image'}
            </label>
            {uploadedFile && localPreviewUrl && (
              <div className={styles.uploadedFileName}>
                {uploadedFile.name}
                {isUploading && ' (uploading...)'}
              </div>
            )}
            {uploadError && (
              <p className={styles.uploadErrorText}>{uploadError}</p>
            )}
          </div>
        </div>
      )}

      {/* URL mode section */}
      {imageMode === 'url' && (
        <div className={styles.fieldWrapper}>
          <label htmlFor="imageUrl" className={styles.label}>
            Image URL <span className={styles.hint}>(http/https)</span>
          </label>
          <Input
            id="imageUrl"
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              setImgBroken(false);
              setUrlError('');
            }}
            error={errors.imageUrl || urlError}
            placeholder="https://example.com/photo.jpg"
            disabled={isLoading}
          />
        </div>
      )}

      {/* Image preview */}
      <div className={styles.previewSection}>
        {((imageMode === 'upload' && uploadResultUrl) || (imageMode === 'url' && urlInput.trim())) && (
          <div className={styles.previewBox}>
            {imgBroken ? (
              <p className={styles.previewError}>⚠ Could not load image preview.</p>
            ) : (
              <>
                <img
                  src={localPreviewUrl || uploadResultUrl || urlInput}
                  alt="Recipe preview"
                  className={styles.preview}
                  onError={() => setImgBroken(true)}
                />
                {isUploading && (
                  <div className={styles.uploadingOverlay}>
                    <span>Uploading...</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading || isUploading}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isLoading || isUploading} disabled={isUploading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
