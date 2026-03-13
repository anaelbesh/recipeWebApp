export const RECIPE_CATEGORIES = [
  'Meat',
  'Dairy',
  'Parve',
  'Desserts',
  'Pastries / Baked Goods',
  'Bread',
  'Salads',
  'Asian',
  'Sandwiches / Wraps',
  'Comfort Food',
  'Healthy / Light',
  'Sauces & Spreads',
  'Breakfast',
  'Gluten-Free',
  'Other',
] as const;

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

/** For filter dropdowns — prepend "All" so user can clear the filter */
export const RECIPE_CATEGORY_FILTER_OPTIONS = ['All', ...RECIPE_CATEGORIES] as const;
