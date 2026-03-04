import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usersApi, type UpdateProfilePayload } from '../../api/users';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { FormError } from '../ui/FormError';
import { AvatarUploader } from './AvatarUploader';
import styles from './EditProfileModal.module.css';

interface EditProfileModalProps {
  onClose: () => void;
}

export function EditProfileModal({ onClose }: EditProfileModalProps) {
  const { user, setUser } = useAuth();

  const [username, setUsername] = useState(user?.username ?? '');
  const [avatarPreview, setAvatarPreview] = useState(
    user?.profilePicture ?? '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const hasChanges =
    username !== (user?.username ?? '') ||
    avatarPreview !== (user?.profilePicture ?? '');

  const handleSave = async () => {
    if (!user) return;

    const trimmed = username.trim();
    if (!trimmed) {
      setError('Username cannot be empty.');
      return;
    }

    const payload: UpdateProfilePayload = {};
    if (trimmed !== user.username) payload.username = trimmed;
    if (avatarPreview !== (user.profilePicture ?? ''))
      payload.profilePicture = avatarPreview;

    setSaving(true);
    try {
      const updated = await usersApi.updateProfile(user.id, payload);
      // Keep the email from the current user context since mock may not carry it
      setUser({ ...user, ...updated, email: user.email });
      onClose();
    } catch {
      setError('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdrop}>
      <div className={styles.modal} role="dialog" aria-label="Edit profile">
        <h2 className={styles.heading}>Edit Profile</h2>

        <FormError message={error} />

        <div className={styles.avatarRow}>
          <AvatarUploader
            src={avatarPreview || undefined}
            username={username}
            onChange={setAvatarPreview}
            size={80}
          />
          <span className={styles.avatarHint}>Click to change photo</span>
        </div>

        <Input
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            isLoading={saving}
            disabled={!hasChanges || saving}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
