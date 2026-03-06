import styles from './Pagination.module.css';

interface PaginationProps {
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pages, onPageChange }: PaginationProps) {
  if (pages <= 1) return null;

  // Show up to 7 page numbers; use ellipsis for larger sets
  const pageNumbers: (number | '…')[] = [];
  if (pages <= 7) {
    for (let i = 1; i <= pages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(1);
    if (page > 4) pageNumbers.push('…');
    for (
      let i = Math.max(2, page - 2);
      i <= Math.min(pages - 1, page + 2);
      i++
    )
      pageNumbers.push(i);
    if (page < pages - 3) pageNumbers.push('…');
    pageNumbers.push(pages);
  }

  return (
    <nav className={styles.container} aria-label="Pagination">
      <button
        className={styles.arrow}
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        ← Prev
      </button>

      <div className={styles.pages}>
        {pageNumbers.map((n, idx) =>
          n === '…' ? (
            <span key={`ellipsis-${idx}`} className={styles.ellipsis}>
              …
            </span>
          ) : (
            <button
              key={n}
              className={`${styles.pageBtn} ${n === page ? styles.active : ''}`}
              onClick={() => onPageChange(n as number)}
              aria-label={`Page ${n}`}
              aria-current={n === page ? 'page' : undefined}
            >
              {n}
            </button>
          ),
        )}
      </div>

      <button
        className={styles.arrow}
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pages}
        aria-label="Next page"
      >
        Next →
      </button>
    </nav>
  );
}
