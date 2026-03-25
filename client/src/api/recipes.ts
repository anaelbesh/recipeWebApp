import apiClient from './client';
import type {
  Recipe,
  RecipeListResponse,
  AiSearchResponse,
  CreateRecipePayload,
  RecipeComment,
} from '../types/recipe';

export type UpdateRecipePayload = Partial<CreateRecipePayload>;

export interface GetRecipesParams {
  /** Cursor for cursor-based pagination (replaces page for infinite scroll). */
  cursor?: string;
  /** Legacy page number — used for search results. */
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  category?: string;
}

export interface GetMyRecipesParams {
  /** Cursor for cursor-based pagination (preferred for infinite scroll). */
  cursor?: string;
  /** Legacy page number — used for paginated requests. */
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
    if (params.cursor)                        cleanParams.cursor = params.cursor;
    else if (params.page !== undefined)       cleanParams.page   = params.page;
    if (params.limit !== undefined)           cleanParams.limit  = params.limit;
    if (params.search)                        cleanParams.search = params.search;
    if (params.sort)                          cleanParams.sort   = params.sort;
    if (params.category && params.category !== 'All') cleanParams.category = params.category;

    const { data } = await apiClient.get<RecipeListResponse>('/recipes', {
      params: cleanParams,
    });
    return data;
  },

  /**
   * Fetch recipes created by the currently authenticated user.
   * Uses GET /api/recipes?mine=true — the backend filters by req.user.id from the JWT.
   * Supports both cursor-based (preferred) and page-based pagination.
   * The apiClient interceptor automatically attaches the Authorization: Bearer <token> header.
   */
  getMyRecipes: async (
    params: GetMyRecipesParams = {},
  ): Promise<RecipeListResponse> => {
    const cleanParams: Record<string, string | number | boolean> = {
      mine: true,
    };
    if (params.cursor)                  cleanParams.cursor = params.cursor;
    else if (params.page !== undefined) cleanParams.page   = params.page;
    if (params.limit !== undefined)     cleanParams.limit  = params.limit;
    if (params.sort)                    cleanParams.sort   = params.sort;

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

  toggleLike: async (recipeId: string): Promise<{ liked: boolean; message: string }> => {
    const { data } = await apiClient.post(`/recipes/${recipeId}/likes`);
    return data;
  },

  getComments: async (recipeId: string): Promise<RecipeComment[]> => {
    const { data } = await apiClient.get<RecipeComment[]>(`/recipes/${recipeId}/comments`);
    return data;
  },

  addComment: async (recipeId: string, content: string): Promise<RecipeComment> => {
    const { data } = await apiClient.post<RecipeComment>(`/recipes/${recipeId}/comments`, { content });
    return data;
  },

  updateComment: async (commentId: string, content: string): Promise<RecipeComment> => {
    const { data } = await apiClient.put<RecipeComment>(`/comments/${commentId}`, { content });
    return data;
  },

  deleteComment: async (commentId: string): Promise<void> => {
    await apiClient.delete(`/comments/${commentId}`);
  },

  aiSearchRecipes: async (params: {
    q: string;
    category?: string;
    limit?: number;
  }): Promise<AiSearchResponse> => {
    const cleanParams: Record<string, string | number> = { q: params.q };
    if (params.category && params.category !== 'All') cleanParams.category = params.category;
    if (params.limit) cleanParams.limit = params.limit;
    const { data } = await apiClient.get<AiSearchResponse>('/recipes/ai-search', {
      params: cleanParams,
    });
    return data;
  },

  /**
   * Upload a recipe image file.
   * Sends multipart/form-data with field "image".
   * Returns { imageUrl: "/uploads/recipe-images/<filename>" }
   */
  uploadImage: async (file: File): Promise<{ imageUrl: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    const { data } = await apiClient.post<{ imageUrl: string }>(
      '/uploads/recipe-image',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return data;
  },
};
