import apiClient from './client';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** A recipe source returned by the RAG chat endpoint. */
export interface AiSource {
  recipeId: string;
  title: string;
  category: string;
  imageUrl?: string;
  snippet: string;
  /** Only present when AI_DEBUG=true on the server. */
  score?: number;
  /** Only present when AI_DEBUG=true on the server. */
  reason?: 'semantic' | 'keyword-fallback';
}

/** @deprecated Use AiSource */
export type AiRecipeSnippet = AiSource;

export interface AiChatResponse {
  requestId: string;
  answer: string;
  /** Primary intent-matched recipes. */
  sources: AiSource[];
  /** Additional suggestions from other categories ("You might also like"). */
  secondarySources: AiSource[];
  followUpQuestion: string;
  fallback?: string;
}

export interface AiChatRequest {
  message: string;
  locale?: 'en-US' | 'he-IL';
  history?: AiChatMessage[];
  category?: string; // optional filter hint (backward compat)
}

// ── Parse endpoint ────────────────────────────────────────────────────────────

export interface AiParseFilters {
  categoriesInclude: string[];
  kosherType: string | null;
  cookingMethod: string | null;
  keywordsInclude: string[];
  keywordsExclude: string[];
  maxMinutes: number | null;
}

export interface AiParseResponse {
  requestId: string;
  normalizedQuery: string;
  filters: AiParseFilters;
  warnings: string[];
  confidence: number;
}

export interface AiParseRequest {
  query: string;
  locale?: 'en-US' | 'he-IL';
  maxResults?: number;
}

export const aiApi = {
  chat: async (payload: AiChatRequest): Promise<AiChatResponse> => {
    const { data } = await apiClient.post<AiChatResponse>('/ai/chat', payload);
    return data;
  },

  parse: async (payload: AiParseRequest): Promise<AiParseResponse> => {
    const { data } = await apiClient.post<AiParseResponse>('/ai/search/parse', payload);
    return data;
  },
};

