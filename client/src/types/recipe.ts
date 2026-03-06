export interface Recipe {
  _id: string;
  title: string;
  instructions: string;
  ingredients: string[];
  imageUrl?: string;
  createdBy:
    | { _id: string; username: string; profilePicture?: string }
    | string;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeListResponse {
  items: Recipe[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface CreateRecipePayload {
  title: string;
  instructions: string;
  ingredients?: string[];
  imageUrl?: string;
}
