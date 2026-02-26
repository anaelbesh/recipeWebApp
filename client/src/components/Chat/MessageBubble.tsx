import { Message } from '../../types/chat';
import styles from './MessageBubble.module.css';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

function formatTime(timestamp: string | undefined): string {
  const date = timestamp ? new Date(timestamp) : new Date();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getStatusIcon(message: Message, isOwn: boolean): string {
  if (!isOwn) return '';

  if (message.isRead) {
    return '✓✓';
  } else if (message.status === 'delivered' || message._id) {
    return '✓';
  } else {
    return '○';
  }
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const statusIcon = getStatusIcon(message, isOwn);
  const isRead = message.isRead;

  return (
    <div className={`${styles.message} ${isOwn ? styles.own : styles.other}`}>
      <div className={styles.bubble}>
        <div className={styles.content}>{message.message}</div>
        <div className={styles.footer}>
          <span className={styles.time}>{formatTime(message.createdAt)}</span>
          {isOwn && statusIcon && (
            <span className={`${styles.checkIcon} ${isRead ? styles.read : ''}`}>
              {statusIcon}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

