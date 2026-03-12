export const RECIPE_CATEGORIES = [
  'Pizza',
  'Pasta',
  'Burger',
  'Fish',
  'Salad',
  'Chicken',
  'Meat',
  'Grill',
  'Spreads',
  'Other',
] as const;

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];
