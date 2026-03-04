import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { postsApi, type Post } from '../api/posts';
import { AvatarUploader } from '../components/profile/AvatarUploader';
import { PostGrid } from '../components/profile/PostGrid';
import { EditProfileModal } from '../components/profile/EditProfileModal';
import { Button } from '../components/ui/Button';
import styles from './ProfilePage.module.css';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    postsApi.getByUser(user.id).then((data) => {
      if (!cancelled) {
        setPosts(data);
        setPostsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <AvatarUploader
          src={user.profilePicture || undefined}
          username={user.username}
          editable={false}
          size={96}
        />

        <div className={styles.info}>
          <h1 className={styles.username}>{user.username}</h1>
          <p className={styles.email}>{user.email}</p>
          <div className={styles.headerActions}>
            <Button variant="secondary" onClick={() => setShowEdit(true)}>
              Edit Profile
            </Button>
            <Button variant="secondary" onClick={() => navigate('/chat')}>
              Go to Chat
            </Button>
          </div>
        </div>
      </header>

      <section className={styles.postsSection}>
        <h2 className={styles.sectionTitle}>My Posts</h2>
        <PostGrid posts={posts} loading={postsLoading} />
      </section>

      <div className={styles.logoutRow}>
        <Button variant="danger" onClick={handleLogout}>
          Logout
        </Button>
      </div>

      {showEdit && <EditProfileModal onClose={() => setShowEdit(false)} />}
    </div>
  );
}
