import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Model constants ────────────────────────────────────────────────────────────
// Override via GEMINI_EMBED_MODEL env var (include the 'models/' prefix).
// Default: models/gemini-embedding-001
// To discover available models for your key: GET /api/ai/models
export const GEMINI_EMBED_MODEL =
  process.env.GEMINI_EMBED_MODEL || 'models/gemini-embedding-001';

// ── Error type ─────────────────────────────────────────────────────────────────

export type EmbedErrorKind =
  | 'no-key'          // GEMINI_API_KEY not set
  | 'model-not-found' // HTTP 404 — wrong model name / endpoint
  | 'auth'            // HTTP 401 / 403 — bad key or permission
  | 'quota'           // HTTP 429 — rate limited / quota exceeded
  | 'network'         // ENOTFOUND / ETIMEDOUT / no HTTP response
  | 'api-error';      // any other Gemini API error

/**
 * Structured error thrown by Gemini helpers so callers can react to the cause.
 * Controller maps `kind` → HTTP status + user-facing message.
 */
export class EmbedError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly hint?: string,
    public readonly kind: EmbedErrorKind = 'api-error',
  ) {
    super(message);
    this.name = 'EmbedError';
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('[gemini] GEMINI_API_KEY present:', !!apiKey);
  if (!apiKey) {
    throw new EmbedError(
      'GEMINI_API_KEY is not set',
      undefined,
      'Add GEMINI_API_KEY to your .env file and restart the server',
      'no-key',
    );
  }
  return apiKey;
}

/** Maps a caught SDK / network error to a typed EmbedError. Never re-wraps EmbedError. */
function mapGeminiError(err: any, modelName: string): never {
  if (err instanceof EmbedError) throw err;

  // SDK HTTP errors expose `.status` (number); axios-style errors use `.response.status`
  const status: number | undefined = err?.status ?? err?.response?.status;
  const message: string = err?.message ?? String(err);

  console.error(
    `[gemini] Gemini call FAILED — model: ${modelName}${status ? `, HTTP ${status}` : ''}: ${message}`,
  );

  if (status === 404) {
    throw new EmbedError(
      `Gemini model not found (HTTP 404) — model: ${modelName}`,
      err,
      `Model "${modelName}" is not available for this API key. ` +
        'Call GET /api/ai/models to list available models, ' +
        'then set GEMINI_EMBED_MODEL or GEMINI_CHAT_MODEL in your .env ' +
        "(include the 'models/' prefix, e.g. models/gemini-embedding-001).",
      'model-not-found',
    );
  }
  if (status === 401 || status === 403) {
    throw new EmbedError(
      `Gemini auth error (HTTP ${status})`,
      err,
      'API key is invalid or lacks API permission — check Google AI Studio',
      'auth',
    );
  }
  if (status === 429) {
    throw new EmbedError(
      'Gemini quota exceeded (HTTP 429)',
      err,
      'Wait and retry, or check your quota / billing in Google AI Studio',
      'quota',
    );
  }

  // Network errors (no HTTP response at all)
  const code: string | undefined = err?.code;
  if (!status || code === 'ENOTFOUND' || code === 'ETIMEDOUT' || code === 'ECONNRESET') {
    throw new EmbedError(
      `Network error calling Gemini: ${message}`,
      err,
      'Check server connectivity to generativelanguage.googleapis.com',
      'network',
    );
  }

  throw new EmbedError(
    `Gemini API error (HTTP ${status}): ${message}`,
    err,
    'See server logs for details',
    'api-error',
  );
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generates an embedding vector via the official @google/generative-ai SDK.
 * Uses apiVersion "v1" because text-embedding-004 is only on the stable endpoint.
 * THROWS EmbedError on failure — callers decide on fallback.
 */
export async function embedText(text: string): Promise<number[]> {
  const apiKey = getApiKey();
  console.log(`[gemini] embedText — model: ${GEMINI_EMBED_MODEL}`);

  const genAI = new GoogleGenerativeAI(apiKey);
  // Use the SDK default apiVersion (v1beta). Do NOT force v1 — gemini-embedding-001
  // is available on v1beta. Model name must include the 'models/' prefix.
  const model = genAI.getGenerativeModel({ model: GEMINI_EMBED_MODEL });

  try {
    const result = await model.embedContent(text);
    const values = result.embedding?.values;

    if (!Array.isArray(values) || values.length === 0) {
      throw new EmbedError(
        'Gemini returned an empty embedding vector',
        result,
        `Unexpected API response for model "${GEMINI_EMBED_MODEL}"`,
        'api-error',
      );
    }

    console.log(`[gemini] embedText succeeded — vector length: ${values.length}`);
    return values;
  } catch (err: any) {
    mapGeminiError(err, GEMINI_EMBED_MODEL);
  }
}

/**
 * Computes cosine similarity between two vectors.
 * Returns a value between -1 and 1 (1 = identical direction).
 * Returns -1 if either vector is empty or lengths differ.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return -1;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return -1;
  return dot / denom;
}

/**
 * Builds a single searchText string from recipe fields.
 * Instructions are capped at 800 characters to keep the embedding context focused.
 */
export function buildSearchText(
  title: string,
  category: string,
  ingredients: string[],
  instructions: string,
  kosherType?: string,
  cookingMethod?: string,
  dishType?: string,
): string {
  return [
    title,
    category,
    ingredients.join(', '),
    instructions.slice(0, 800),
    ...(kosherType    ? [`kosher:${kosherType}`]    : []),
    ...(cookingMethod ? [`method:${cookingMethod}`] : []),
    ...(dishType      ? [`dish:${dishType}`]        : []),
  ]
    .filter(Boolean)
    .join('\n');
}
