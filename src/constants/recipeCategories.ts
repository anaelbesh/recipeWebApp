export const RECIPE_CATEGORIES = [
  'Pizza',
  'Pasta',
  'Burger',
  'Spreads',
  'Salad',
  'Dessert',
  'Vegan',
  'Other',
] as const;

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];
