import { useState } from 'react';
import type { RecipeComment } from '../../types/recipe';
import { recipesApi } from '../../api/recipes';
import { useAuth } from '../../context/AuthContext';
import styles from './RecipeComments.module.css';

const EMOJIS = ['😀', '😋', '😍', '👍', '🎉', '🔥', '❤️', '😂'];

interface RecipeCommentsProps {
  recipeId: string;
  comments: RecipeComment[];
  onCommentAdded: (comment: RecipeComment) => void;
}

export function RecipeComments({ recipeId, comments, onCommentAdded }: RecipeCommentsProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setIsSubmitting(true);
    setError('');
    try {
      const newComment = await recipesApi.addComment(recipeId, content.trim());
      onCommentAdded(newComment);
      setContent('');
      setShowEmoji(false);
    } catch (err: unknown) {
      setError('Failed to add comment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.commentsSection}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Comments</h2>
        <span className={styles.count}>{comments.length}</span>
      </div>

      {user ? (
        <form onSubmit={handleSubmit} className={styles.form}>
          <textarea
            className={styles.textarea}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write a comment..."
            rows={3}
          />
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.emojiButton}
              onClick={() => setShowEmoji((prev) => !prev)}
              aria-label="Toggle emoji picker"
            >
              😊
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting || !content.trim()}
            >
              {isSubmitting ? 'Posting...' : 'Post'}
            </button>
          </div>
          {showEmoji && (
            <div className={styles.emojiPicker}>
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={styles.emojiItem}
                  onClick={() => setContent((prev) => prev + emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          {error && <p className={styles.error}>{error}</p>}
        </form>
      ) : (
        <p className={styles.loginHint}>Log in to add a comment.</p>
      )}

      <div className={styles.list}>
        {comments.length === 0 && <p className={styles.empty}>No comments yet.</p>}
        {comments.map((comment) => (
          <div key={comment._id} className={styles.comment}>
            <div className={styles.commentHeader}>
              <div className={styles.userInfo}>
                {comment.user.profilePicture ? (
                  <img
                    src={comment.user.profilePicture}
                    alt={comment.user.username}
                    className={styles.avatar}
                  />
                ) : (
                  <div className={styles.avatarFallback}>
                    {comment.user.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <span className={styles.username}>{comment.user.username}</span>
              </div>
              <span className={styles.date}>
                {new Date(comment.createdAt).toLocaleDateString()}
              </span>
            </div>
            <p className={styles.commentBody}>{comment.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

