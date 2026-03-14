import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { ragChat, ChatMessage, RagSource } from '../services/aiRagService';
import { EmbedError, embedText, buildSearchText } from '../services/geminiEmbeddings';
import { Recipe } from '../models/Recipe';
import { parseSearchQuery, ParseConfidenceError } from '../services/aiSearchParseService';
import { isMockEnabled } from '../services/aiMockService';

// ── Helpers ───────────────────────────────────────────────────────────────────

function genRequestId(): string {
  return 'req_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Simple in-memory rate limiter: 20 AI requests per IP per minute.
 * Mount on AI routes only — not on public recipe routes.
 * Bypassed when mock mode is active (no LLM cost to protect).
 */
export function aiRateLimiter(req: Request, res: Response, next: NextFunction): void {
  // No cost in mock mode — skip limiting so tests run freely
  if (isMockEnabled()) {
    next();
    return;
  }
  const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  const now = Date.now();
  const WINDOW_MS = 60_000;
  const LIMIT = 20;
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }
  if (entry.count >= LIMIT) {
    res.status(429).json({ message: 'Too many AI requests. Please wait a minute and try again.' });
    return;
  }
  entry.count++;
  next();
}

function embedErrorHttp(err: EmbedError): { status: number; userMessage: string } {
  const { kind } = err;
  const status =
    kind === 'quota'   ? 429 :
    kind === 'network' ? 503 :
    502; // no-key | auth | model-not-found | api-error
  const userMessage =
    kind === 'no-key'          ? 'AI service not configured (missing API key)' :
    kind === 'model-not-found' ? 'Gemini model not found — check GEMINI_CHAT_MODEL in .env' :
    kind === 'auth'            ? 'Gemini authentication error — verify GEMINI_API_KEY' :
    kind === 'quota'           ? 'AI rate limit reached — please try again later' :
    kind === 'network'         ? 'Network error reaching AI service' :
                                 'AI service unavailable';
  return { status, userMessage };
}

/**
 * GET /api/ai/models
 * Debug endpoint: lists all Gemini models available for the current API key.
 * Use this to discover which embedding / chat models you can use.
 */
// ── GET /api/ai/models ────────────────────────────────────────────────────────

/**
 * Debug endpoint: lists all Gemini models available for the current API key.
 * Use this to discover which embedding / chat models you can use.
 */
export const listModels = async (_req: Request, res: Response): Promise<void> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ message: 'GEMINI_API_KEY is not set' });
    return;
  }
  try {
    // SDK v0.24 does not expose listModels — call REST directly
    const { data } = await axios.get(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { timeout: 10000 },
    );
    const models = (data?.models ?? []).map((m: any) => ({
      name: m.name,
      displayName: m.displayName,
      supportedGenerationMethods: m.supportedGenerationMethods,
    }));
    res.status(200).json({ models });
  } catch (err: any) {
    console.error('[ai/models] listModels error:', err?.message ?? err);
    res.status(500).json({ message: 'Failed to list models', reason: err?.message });
  }
};

/**
 * POST /api/ai/search/parse
 * Body: { query: string; locale?: "en-US"|"he-IL"; maxResults?: number }
 *
 * Converts a free-text query into a structured search object (no DB query).
 * HTTP 422 → low-confidence / unparseable query.
 */
export const parseSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, locale, maxResults } = req.body as {
      query?: string;
      locale?: string;
      maxResults?: number;
    };

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      res.status(400).json({ message: '`query` must be at least 2 characters' });
      return;
    }

    const safeLocale: string = locale === 'he-IL' ? 'he-IL' : 'en-US';
    const safeMaxResults: number = Math.min(50, Math.max(1, Number(maxResults) || 10));

    const result = await parseSearchQuery(query.trim(), safeLocale, safeMaxResults);

    res.status(200).json({
      requestId: genRequestId(),
      normalizedQuery: result.normalizedQuery,
      filters: result.filters,
      warnings: result.warnings,
      confidence: result.confidence,
    });
  } catch (err: any) {
    if (err instanceof ParseConfidenceError) {
      res.status(422).json({
        message: 'Query confidence too low to parse reliably',
        warnings: err.warnings,
        confidence: err.confidence,
        partial: err.partial,
      });
      return;
    }
    if (err instanceof EmbedError) {
      const { status, userMessage } = embedErrorHttp(err);
      res.status(status).json({ message: userMessage, reason: err.message, hint: err.hint });
      return;
    }
    console.error('[ai/parse] error:', err?.message ?? err);
    res.status(503).json({ message: 'AI service unavailable', reason: err?.message });
  }
};

/**
 * POST /api/ai/chat
 * Body: { message: string; locale?: "en-US"|"he-IL"; history?: ChatMessage[]; category?: string }
 *
 * RAG assistant: returns answer grounded in DB recipes + sources for trust/debug.
 */
export const chat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, locale, history, category } = req.body as {
      message?: string;
      locale?: string;
      history?: ChatMessage[];
      category?: string; // kept for backward compatibility
    };

    if (!message || typeof message !== 'string' || message.trim().length < 2) {
      res.status(400).json({ message: 'message must be at least 2 characters' });
      return;
    }

    const safeLocale: string = locale === 'he-IL' ? 'he-IL' : 'en-US';
    const safeHistory: ChatMessage[] = Array.isArray(history)
      ? history
          .filter(
            (m) =>
              m &&
              (m.role === 'user' || m.role === 'assistant') &&
              typeof m.content === 'string',
          )
          .slice(-12)
      : [];

    const result = await ragChat(message.trim(), safeLocale, safeHistory, category);

    // Strip score and reason unless AI_DEBUG=true (debug-only fields)
    const debug = process.env.AI_DEBUG === 'true';
    const stripSource = ({ recipeId, title, category: cat, imageUrl, snippet, score, reason }: RagSource) =>
      debug
        ? { recipeId, title, category: cat, imageUrl, snippet, score, reason }
        : { recipeId, title, category: cat, imageUrl, snippet };

    res.status(200).json({
      requestId: genRequestId(),
      answer: result.answer,
      sources: result.primarySources.map(stripSource),
      secondarySources: result.secondarySources.map(stripSource),
      followUpQuestion: result.followUpQuestion,
      ...(result.fallback ? { fallback: result.fallback } : {}),
    });
  } catch (err: any) {
    console.error('[ai/chat] error:', err?.message ?? err);

    if (err instanceof EmbedError) {
      const { status, userMessage } = embedErrorHttp(err);
      res.status(status).json({ message: userMessage, reason: err.message, hint: err.hint });
      return;
    }

    res.status(503).json({
      message: 'AI service unavailable',
      reason: err?.message ?? 'Unexpected error',
    });
  }
};



/**
 * POST /api/ai/backfill-embeddings
 * Generates and stores embeddings for all recipes that are missing them.
 * Protected: requires auth (verifyToken on the route).
 * Processes in small batches with a short delay to avoid hammering the API.
 */
export const backfillEmbeddings = async (_req: Request, res: Response): Promise<void> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ message: 'GEMINI_API_KEY is not set' });
    return;
  }

  // Find all recipes without a valid non-empty embedding
  const missing = await Recipe.find({
    $or: [
      { embedding: { $exists: false } },
      { embedding: { $size: 0 } },
    ],
  })
    .select('_id title category ingredients instructions')
    .lean();

  if (missing.length === 0) {
    res.status(200).json({ message: 'All recipes already have embeddings.', updated: 0 });
    return;
  }

  // Start processing asynchronously so the HTTP response returns immediately
  res.status(202).json({
    message: `Backfill started for ${missing.length} recipe(s). Check server logs for progress.`,
    total: missing.length,
  });

  const BATCH_DELAY_MS = 300; // small delay between calls to stay within rate limits
  let updated = 0;
  let failed = 0;

  for (const recipe of missing) {
    try {
      const searchText = buildSearchText(
        recipe.title,
        recipe.category,
        recipe.ingredients ?? [],
        recipe.instructions,
      );
      const embedding = await embedText(searchText);
      await Recipe.findByIdAndUpdate(recipe._id, { searchText, embedding });
      updated++;
      console.log(`[backfill] ✓ ${recipe.title} (${updated}/${missing.length})`);
    } catch (err: any) {
      failed++;
      console.error(`[backfill] ✗ ${recipe.title}: ${err?.message ?? err}`);
      // If it's a quota/auth error, abort early to avoid wasting API calls
      if (err instanceof EmbedError && (err.kind === 'quota' || err.kind === 'auth' || err.kind === 'no-key')) {
        console.error(`[backfill] Aborting early due to ${err.kind} error.`);
        break;
      }
    }
    // Brief pause between requests
    await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }

  console.log(`[backfill] Complete — ${updated} updated, ${failed} failed.`);
};
