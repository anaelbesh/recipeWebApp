/**
 * LLM Client — thin wrapper around the Gemini SDK.
 *
 * This is the ONLY place in the backend that instantiates GoogleGenerativeAI.
 * It provides:
 *  - Request timeout (Promise.race)
 *  - Exponential-backoff retry (transient network errors only)
 *  - Structured error mapping to EmbedError (never leaks the API key)
 *
 * Callers receive raw text; JSON parsing / post-processing belongs in the service layer.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { EmbedError } from './geminiEmbeddings';

// ── Public types ──────────────────────────────────────────────────────────────

export interface LlmMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface LlmChatOptions {
  temperature?: number;
  maxOutputTokens?: number;
  /** Milliseconds before the request is aborted (default 20 000). */
  timeoutMs?: number;
  /** Max extra attempts after the first failure on retryable errors (default 2). */
  maxRetries?: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RETRIES = 2;

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new EmbedError(
      'GEMINI_API_KEY is not set',
      undefined,
      'Add GEMINI_API_KEY to your .env file and restart',
      'no-key',
    );
  }
  return key;
}

/** Races a promise against a timeout; tagged ETIMEDOUT so the retry logic can detect it. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timerId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timerId = setTimeout(
      () =>
        reject(
          Object.assign(new Error(`LLM request timed out after ${ms}ms`), {
            code: 'ETIMEDOUT',
          }),
        ),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timerId!));
}

/** Only network / timeout errors are worth retrying; auth/quota/not-found are not. */
function isRetryable(err: unknown): boolean {
  const e = err as any;
  const status: number | undefined = e?.status ?? e?.response?.status;
  if (status === 401 || status === 403 || status === 404 || status === 429) return false;
  const code: string | undefined = e?.code;
  return (
    !status ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    /timeout/i.test(e?.message ?? '')
  );
}

/** Maps any error to a typed EmbedError. Declared `never` — it always throws. */
function mapError(err: unknown, modelName: string): never {
  if (err instanceof EmbedError) throw err;
  const e = err as any;
  const status: number | undefined = e?.status ?? e?.response?.status;
  const msg: string = e?.message ?? String(e);

  if (status === 404)
    throw new EmbedError(
      `Model not found: ${modelName}`,
      err,
      'Check GEMINI_CHAT_MODEL / GEMINI_EMBED_MODEL in .env',
      'model-not-found',
    );
  if (status === 401 || status === 403)
    throw new EmbedError(
      `Auth error (HTTP ${status})`,
      err,
      'Verify GEMINI_API_KEY in Google AI Studio',
      'auth',
    );
  if (status === 429)
    throw new EmbedError(
      'Rate limited (HTTP 429)',
      err,
      'Wait and retry or check your Gemini quota',
      'quota',
    );
  const code: string | undefined = e?.code;
  if (
    !status ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    /timeout/i.test(msg)
  )
    throw new EmbedError(
      `Network error: ${msg}`,
      err,
      'Check server connectivity to generativelanguage.googleapis.com',
      'network',
    );
  throw new EmbedError(
    `API error (HTTP ${status ?? 'unknown'}): ${msg}`,
    err,
    'See server logs',
    'api-error',
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Core Gemini content-generation call.
 *
 * Architecture note (Route → Controller → Service → **LLM Client**):
 * This is the LLM Client layer. Services call this; controllers never do.
 *
 * @returns Raw text from the model. Callers must handle JSON parsing.
 * @throws {EmbedError} on all failure modes (auth, quota, network, timeout, not-found).
 */
export async function generateContent(
  modelName: string,
  systemInstruction: string,
  history: LlmMessage[],
  userContent: string,
  opts: LlmChatOptions = {},
): Promise<string> {
  const {
    temperature = 0.3,
    maxOutputTokens = 1024,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = opts;

  const apiKey = getApiKey(); // throws EmbedError('no-key') when missing
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel(
    { model: modelName, systemInstruction },
    { apiVersion: 'v1beta' },
  );

  let lastErr: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delayMs = 500 * Math.pow(2, attempt - 1); // 500 ms → 1 000 ms
      await new Promise((r) => setTimeout(r, delayMs));
      console.warn(
        `[llmClient] Retry ${attempt}/${maxRetries} for model "${modelName}"`,
      );
    }

    try {
      const result = await withTimeout(
        model.generateContent({
          contents: [
            ...history,
            { role: 'user', parts: [{ text: userContent }] },
          ],
          generationConfig: { temperature, maxOutputTokens },
        }),
        timeoutMs,
      );
      return result.response.text();
    } catch (err: unknown) {
      lastErr = err;
      if (!isRetryable(err)) break;
    }
  }

  return mapError(lastErr, modelName);
}
