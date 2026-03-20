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
