import { Skeleton } from '../ui/Skeleton';
import { PostCard } from './PostCard';
import styles from './PostGrid.module.css';

export interface PostItem {
  id: string;
  title: string;
  content: string;
  createdAt?: string;
}

interface PostGridProps {
  posts: PostItem[];
  loading?: boolean;
}

export function PostGrid({ posts, loading = false }: PostGridProps) {
  if (loading) {
    return (
      <div className={styles.grid}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={130} borderRadius={12} />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return <p className={styles.empty}>No posts yet.</p>;
  }

  return (
    <div className={styles.grid}>
      {posts.map((p) => (
        <PostCard
          key={p.id}
          title={p.title}
          content={p.content}
          createdAt={p.createdAt}
        />
      ))}
    </div>
  );
}
