import apiClient from './client';
import type {
  Recipe,
  RecipeListResponse,
  CreateRecipePayload,
} from '../types/recipe';

export type UpdateRecipePayload = Partial<CreateRecipePayload>;

export interface GetRecipesParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
}

export interface GetMyRecipesParams {
  page?: number;
  limit?: number;
  sort?: string;
}

export const recipesApi = {
  getRecipes: async (
    params: GetRecipesParams = {},
  ): Promise<RecipeListResponse> => {
    // omit empty search so the backend doesn't run a $text query on an empty string
    const cleanParams: Record<string, string | number> = {};
    if (params.page !== undefined) cleanParams.page = params.page;
    if (params.limit !== undefined) cleanParams.limit = params.limit;
    if (params.search) cleanParams.search = params.search;
    if (params.sort) cleanParams.sort = params.sort;

    const { data } = await apiClient.get<RecipeListResponse>('/recipes', {
      params: cleanParams,
    });
    return data;
  },

  /**
   * Fetch recipes created by the currently authenticated user.
   * Uses GET /api/recipes?mine=true — the backend filters by req.user.id from the JWT.
   * The apiClient interceptor automatically attaches the Authorization: Bearer <token> header.
   */
  getMyRecipes: async (
    params: GetMyRecipesParams = {},
  ): Promise<RecipeListResponse> => {
    const cleanParams: Record<string, string | number | boolean> = {
      mine: true,
    };
    if (params.page !== undefined) cleanParams.page = params.page;
    if (params.limit !== undefined) cleanParams.limit = params.limit;
    if (params.sort) cleanParams.sort = params.sort;

    const { data } = await apiClient.get<RecipeListResponse>('/recipes', {
      params: cleanParams,
    });
    return data;
  },

  createRecipe: async (payload: CreateRecipePayload): Promise<Recipe> => {
    const { data } = await apiClient.post<{
      message: string;
      recipe: Recipe;
    }>('/recipes', payload);
    return data.recipe;
  },

  getRecipeById: async (id: string): Promise<Recipe> => {
    const { data } = await apiClient.get<{ recipe: Recipe }>(`/recipes/${id}`);
    return data.recipe;
  },

  updateRecipe: async (id: string, payload: UpdateRecipePayload): Promise<Recipe> => {
    const { data } = await apiClient.put<{ message: string; recipe: Recipe }>(
      `/recipes/${id}`,
      payload,
    );
    return data.recipe;
  },

  deleteRecipe: async (id: string): Promise<void> => {
    await apiClient.delete(`/recipes/${id}`);
  },
};
