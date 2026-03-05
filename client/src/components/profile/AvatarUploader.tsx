import { useRef, useState, useEffect } from 'react';
import styles from './AvatarUploader.module.css';

interface AvatarUploaderProps {
  src?: string;
  username?: string;
  /**
   * Called when the user picks a file.
   * `file`    — the raw File object for FormData upload.
   * `preview` — a base64 data-URL for immediate display.
   */
  onChange?: (file: File, preview: string) => void;
  /** If false, clicking does nothing (view-only mode) */
  editable?: boolean;
  size?: number;
}

/**
 * Circular avatar with click-to-upload.
 * Shows the image if `src` is provided, otherwise shows initials.
 */
export function AvatarUploader({
  src,
  username = '',
  onChange,
  editable = true,
  size = 96,
}: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imgError, setImgError] = useState(false);

  // Reset error state when src changes (e.g. user uploads a new photo)
  useEffect(() => { setImgError(false); }, [src]);

  const initials = username
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  const handleClick = () => {
    if (editable && inputRef.current) inputRef.current.click();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onChange) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onChange(file, reader.result);
    };
    reader.readAsDataURL(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  return (
    <div
      className={`${styles.avatar} ${editable ? styles.editable : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
      onClick={handleClick}
      role={editable ? 'button' : undefined}
      tabIndex={editable ? 0 : undefined}
    >
      {src && !imgError ? (
        <img
          src={src}
          alt={username}
          className={styles.img}
          onError={() => setImgError(true)}
        />
      ) : (
        <span className={styles.initials}>{initials}</span>
      )}

      {editable && (
        <>
          <div className={styles.overlay}>
            <CameraIcon />
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className={styles.hidden}
            onChange={handleFile}
          />
        </>
      )}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
