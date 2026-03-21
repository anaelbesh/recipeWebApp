export interface RecipeComment {
  _id: string;
  content: string;
  recipe: string;
  user: {
    _id: string;
    username: string;
    profilePicture?: string;
  };
  createdAt: string;
}
export interface Recipe {
  _id: string;
  title: string;
  instructions: string;
  ingredients: string[];
  imageUrl?: string;
  category: string;
  kosherType?: string;
  cookingMethod?: string;
  dishType?: string;
  createdBy:
    | { _id: string; username: string; profilePicture?: string }
    | string;
  createdAt: string;
  updatedAt: string;
  score?: number; // AI search relevance score (0–1)
  commentCount?: number;
  likeCount?: number;
  likedByMe?: boolean;
}

export interface RecipeListResponse {
  items: Recipe[];
  /** Cursor for the next page (cursor-based pagination). null when no more items. */
  nextCursor: string | null;
  /** True when more items exist beyond this page. */
  hasMore: boolean;
  // Legacy page-based fields (kept for callers that still use them)
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface AiSearchResponse {
  items: Recipe[];
  totalCandidates?: number;
  returned: number;
  aiUsed?: boolean;
  fallback?: 'textSearch' | 'regexSearch';
  message?: string;
  hint?: string;
}

export interface CreateRecipePayload {
  title: string;
  instructions: string;
  ingredients?: string[];
  imageUrl?: string;
  category: string;
  kosherType?: string;
  cookingMethod?: string;
  dishType?: string;
}
