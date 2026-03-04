import styles from './PostCard.module.css';

export interface PostCardProps {
  title: string;
  content: string;
  createdAt?: string;
}

export function PostCard({ title, content, createdAt }: PostCardProps) {
  const snippet =
    content.length > 120 ? content.slice(0, 120) + '…' : content;

  const dateLabel = createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <article className={styles.card}>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.snippet}>{snippet}</p>
      {dateLabel && <time className={styles.date}>{dateLabel}</time>}
    </article>
  );
}
