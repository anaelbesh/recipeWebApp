import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiApi, AiChatMessage, AiSource } from '../api/ai';
import { recipesApi } from '../api/recipes';
import { RECIPE_CATEGORIES } from '../constants/recipeCategories';
import styles from './AiChatWidget.module.css';

// ── Local message type that also carries recipe results ─────────────────────

interface DisplayMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: AiSource[];
  secondarySources?: AiSource[];
  followUpQuestion?: string;
  // error state
  isAiError?: boolean;
  errorReason?: string;
  errorHint?: string;
  retryText?: string;         // the user question to re-send on Retry
  showingKeywords?: boolean;  // true after user clicks "Show keyword results"
  keywordRecipes?: AiSource[];
  keywordLoading?: boolean;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RecipeTile({ recipe }: { recipe: AiSource }) {
  const navigate = useNavigate();
  return (
    <div
      className={styles.recipeTile}
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/recipes/${recipe.recipeId}`)}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/recipes/${recipe.recipeId}`)}
    >
      {recipe.imageUrl ? (
        <img src={recipe.imageUrl} alt={recipe.title} className={styles.tileThumb} />
      ) : (
        <div className={styles.tilePlaceholder}>🍽️</div>
      )}
      <div className={styles.tileInfo}>
        <div className={styles.tileTitle}>{recipe.title}</div>
        <div className={styles.tileCategory}>{recipe.category}</div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className={`${styles.bubble} ${styles.bubbleAssistant}`}>
      <div className={styles.typingDots}>
        <span /><span /><span />
      </div>
    </div>
  );
}

// ── Main widget ────────────────────────────────────────────────────────────────

export function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [category, setCategory] = useState('All');
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your AI recipe assistant. Ask me anything — what to cook tonight, recipes by ingredient, dietary tips, and more! ✨",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Core send logic — can be called for new messages or retry
  const sendMessage = async (text: string) => {
    if (!text || isLoading) return;

    setIsLoading(true);

    // Build history from non-error messages only (last 12 turns, text only)
    const history: AiChatMessage[] = messages
      .filter((m) => !m.isAiError)
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const result = await aiApi.chat({ message: text, category, history });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: result.answer,
          sources: result.sources,
          secondarySources: result.secondarySources?.length > 0 ? result.secondarySources : undefined,
          followUpQuestion: result.followUpQuestion || undefined,
        },
      ]);
    } catch (err: unknown) {
      const response = (err as { response?: { status?: number; data?: { message?: string; reason?: string; hint?: string } } })?.response;
      const status = response?.status;
      const data = response?.data;

      if (status === 400) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Message is too short. Please ask a full question.' },
        ]);
      } else {
        // AI service error — show error bubble with Retry + keyword results option
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            isAiError: true,
            content: data?.message ?? 'AI service unavailable.',
            errorReason: data?.reason,
            errorHint: data?.hint,
            retryText: text,
          },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    sendMessage(text);
  };

  const handleRetry = (msgIndex: number) => {
    const retryText = messages[msgIndex]?.retryText;
    if (!retryText) return;
    setMessages((prev) => prev.filter((_, i) => i !== msgIndex));
    sendMessage(retryText);
  };

  const handleShowKeywords = async (msgIndex: number) => {
    const retryText = messages[msgIndex]?.retryText;
    if (!retryText) return;

    // Mark as loading keyword results
    setMessages((prev) =>
      prev.map((m, i) =>
        i === msgIndex ? { ...m, showingKeywords: true, keywordLoading: true, keywordRecipes: [] } : m,
      ),
    );

    try {
      const result = await recipesApi.getRecipes({ search: retryText, limit: 5 });
      const snippets: AiSource[] = result.items.map((r) => ({
        recipeId: r._id,
        title: r.title,
        category: r.category,
        imageUrl: r.imageUrl,
        snippet: r.instructions.slice(0, 150),
        reason: 'keyword-fallback' as const,
      }));
      setMessages((prev) =>
        prev.map((m, i) =>
          i === msgIndex ? { ...m, keywordLoading: false, keywordRecipes: snippets } : m,
        ),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m, i) =>
          i === msgIndex ? { ...m, keywordLoading: false } : m,
        ),
      );
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating action button */}
      <button
        className={styles.fab}
        onClick={() => setOpen(true)}
        aria-label="Open AI recipe assistant"
        title="AI Recipe Assistant"
        style={{ display: open ? 'none' : 'flex' }}
      >
        ✨
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className={styles.overlay}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Chat drawer */}
      {open && (
        <div className={styles.drawer} role="dialog" aria-label="AI Recipe Assistant">
          {/* Header */}
          <div className={styles.header}>
            <span className={styles.headerTitle}>✨ AI Recipe Assistant</span>
            <button
              className={styles.closeBtn}
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Category filter */}
          <div className={styles.controls}>
            <select
              className={styles.categorySelect}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="All">All categories</option>
              {RECIPE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Messages */}
          <div className={styles.messages} role="log" aria-live="polite">
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.isAiError ? (
                  /* ── Error bubble ── */
                  <div className={`${styles.bubble} ${styles.bubbleError}`}>
                    <span className={styles.errorIcon}>⚠️</span>
                    <span className={styles.errorTitle}>{msg.content}</span>
                    {msg.errorReason && (
                      <div className={styles.errorDetail}>{msg.errorReason}</div>
                    )}
                    {msg.errorHint && (
                      <div className={styles.errorHint}>{msg.errorHint}</div>
                    )}
                    <div className={styles.errorActions}>
                      <button
                        className={styles.retryBtn}
                        onClick={() => handleRetry(i)}
                        disabled={isLoading}
                      >
                        ↺ Retry
                      </button>
                      {!msg.showingKeywords && (
                        <button
                          className={styles.keywordBtn}
                          onClick={() => handleShowKeywords(i)}
                          disabled={isLoading}
                        >
                          Show keyword results
                        </button>
                      )}
                    </div>
                    {msg.showingKeywords && msg.keywordLoading && (
                      <div className={styles.keywordLoading}>Loading keyword results…</div>
                    )}
                    {msg.showingKeywords && !msg.keywordLoading && msg.keywordRecipes && msg.keywordRecipes.length === 0 && (
                      <div className={styles.keywordLoading}>No keyword results found.</div>
                    )}
                    {msg.showingKeywords && !msg.keywordLoading && msg.keywordRecipes && msg.keywordRecipes.length > 0 && (
                      <div className={styles.recipeTiles}>
                        {msg.keywordRecipes.map((r) => (
                          <RecipeTile key={r.recipeId} recipe={r} />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── Normal bubble ── */
                  <div
                    className={`${styles.bubble} ${
                      msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant
                    }`}
                  >
                    {msg.content}
                  </div>
                )}
                {!msg.isAiError && msg.sources && msg.sources.length > 0 && (
                  <div className={styles.recipeTiles}>
                    {msg.sources.slice(0, 5).map((r) => (
                      <RecipeTile key={r.recipeId} recipe={r} />
                    ))}
                  </div>
                )}
                {!msg.isAiError && msg.secondarySources && msg.secondarySources.length > 0 && (
                  <div className={styles.secondarySection}>
                    <div className={styles.secondaryLabel}>You might also like</div>
                    <div className={styles.recipeTiles}>
                      {msg.secondarySources.slice(0, 3).map((r) => (
                        <RecipeTile key={r.recipeId} recipe={r} />
                      ))}
                    </div>
                  </div>
                )}
                {!msg.isAiError && msg.followUpQuestion && (
                  <div className={`${styles.bubble} ${styles.bubbleAssistant}`}>
                    💬 {msg.followUpQuestion}
                  </div>
                )}
              </div>
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className={styles.inputRow}>
            <input
              ref={inputRef}
              className={styles.input}
              type="text"
              placeholder="Ask about recipes…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              aria-label="Message input"
              maxLength={500}
            />
            <button
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              aria-label="Send"
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
