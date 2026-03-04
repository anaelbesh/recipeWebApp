import { useState } from 'react';
import { User } from '../../types/chat';
import styles from './UsersSidebar.module.css';

interface UsersSidebarProps {
  currentUser: User;
  users: User[];
  selectedPartner: User | null;
  onSelectPartner: (user: User) => void;
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function UsersSidebar({
  currentUser,
  users,
  selectedPartner,
  onSelectPartner,
}: UsersSidebarProps) {
  const [searchFilter, setSearchFilter] = useState('');

  const filteredUsers = users.filter(user =>
    user._id !== currentUser._id &&
    (user.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
     user.email.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className={styles.sidebar}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.headerTitle}>Logged in as</h3>
        <div className={styles.currentUser}>
          <div className={styles.currentUserAvatar}>
            {getInitials(currentUser.name)}
          </div>
          <div className={styles.currentUserInfo}>
            <div className={styles.currentUserName}>{currentUser.name}</div>
            <div className={styles.currentUserStatus}>Online</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchContainer}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search users..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
        />
      </div>

      {/* Users List */}
      <div className={styles.usersList}>
        {filteredUsers.map(user => (
          <div
            key={user._id}
            className={`${styles.userItem} ${selectedPartner?._id === user._id ? styles.active : ''}`}
            onClick={() => onSelectPartner(user)}
          >
            <div className={styles.userItemAvatar}>
              {getInitials(user.name)}
            </div>
            <div className={styles.userItemInfo}>
              <div className={styles.userItemName}>{user.name}</div>
              <div className={styles.userItemEmail}>{user.email}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
