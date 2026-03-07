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

/** For filter dropdowns — prepend "All" so user can clear the filter */
export const RECIPE_CATEGORY_FILTER_OPTIONS = ['All', ...RECIPE_CATEGORIES] as const;
