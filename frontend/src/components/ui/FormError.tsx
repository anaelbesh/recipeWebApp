import styles from './FormError.module.css';

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <div className={styles.error}>{message}</div>;
}
