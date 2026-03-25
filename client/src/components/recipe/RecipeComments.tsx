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
  onCommentUpdated?: (comment: RecipeComment) => void;
  onCommentDeleted?: (commentId: string) => void;
}

export function RecipeComments({ recipeId, comments, onCommentAdded, onCommentUpdated, onCommentDeleted }: RecipeCommentsProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isEditingSubmitting, setIsEditingSubmitting] = useState(false);

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

  const handleEditSubmit = async (e: React.FormEvent, commentId: string) => {
    e.preventDefault();
    if (!editContent.trim()) return;
    setIsEditingSubmitting(true);
    try {
      const updated = await recipesApi.updateComment(commentId, editContent.trim());
      onCommentUpdated?.(updated);
      setEditingId(null);
      setEditContent('');
    } catch {
      alert('Failed to update comment.');
    } finally {
      setIsEditingSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    try {
      await recipesApi.deleteComment(commentId);
      onCommentDeleted?.(commentId);
    } catch {
      alert('Failed to delete comment.');
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
              <div className={styles.headerRight}>
                <span className={styles.date}>
                  {new Date(comment.createdAt).toLocaleDateString()}
                </span>
                {user?.id === comment.user._id && (
                  <div className={styles.commentActions}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(comment._id);
                        setEditContent(comment.content);
                      }}
                      className={styles.iconBtn}
                      aria-label="Edit comment"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(comment._id)}
                      className={styles.iconBtn}
                      aria-label="Delete comment"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            </div>
            {editingId === comment._id ? (
              <form onSubmit={(e) => handleEditSubmit(e, comment._id)} className={styles.editForm}>
                <textarea
                  className={styles.textarea}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={2}
                />
                <div className={styles.actions}>
                  <button type="button" onClick={() => setEditingId(null)} className={styles.cancelBtn}>Cancel</button>
                  <button type="submit" className={styles.submitButton} disabled={isEditingSubmitting || !editContent.trim()}>
                    {isEditingSubmitting ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            ) : (
              <p className={styles.commentBody}>{comment.content}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
