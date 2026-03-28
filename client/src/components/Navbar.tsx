import { useState, type FormEvent } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../routes/routes';
import styles from './Navbar.module.css';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const closeMenu = () => setMenuOpen(false);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `${styles.link} ${isActive ? styles.active : ''}`;

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      navigate(`${ROUTES.RECIPES}?search=${encodeURIComponent(q)}`);
    } else {
      navigate(ROUTES.RECIPES);
    }
    closeMenu();
  };

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
    closeMenu();
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.inner}>
        {/* ── Brand ── */}
        <NavLink to={ROUTES.RECIPES} className={styles.brand} onClick={closeMenu}>
          <span className={styles.brandIcon}>🍳</span>
          <span className={styles.brandText}>RecipeApp</span>
        </NavLink>

        {/* ── Desktop nav links ── */}
        <div className={styles.desktopLinks}>
          <NavLink to={ROUTES.RECIPES} className={navLinkClass} end>
            Home
          </NavLink>
          <NavLink to={ROUTES.ADD_RECIPE} className={navLinkClass}>
            Add Recipe
          </NavLink>
          <NavLink to={ROUTES.CHAT} className={navLinkClass}>
            Chat
          </NavLink>
        </div>

        {/* ── Desktop search ── */}
        <form onSubmit={handleSearchSubmit} className={styles.desktopSearch}>
          <input
            type="text"
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recipes…"
            aria-label="Search recipes"
          />
          <button type="submit" className={styles.searchBtn} aria-label="Submit search">
            🔍
          </button>
        </form>

        {/* ── Auth section ── */}
        <div className={styles.authSection}>
          {user ? (
            <>
              <NavLink to={ROUTES.PROFILE} className={`${styles.link} ${styles.profileLink}`}>
                {user.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt={user.username}
                    className={styles.avatar}
                  />
                ) : (
                  <span className={styles.avatarInitial}>
                    {user.username[0].toUpperCase()}
                  </span>
                )}
                <span className={styles.navUsername}>{user.username}</span>
              </NavLink>
              <button className={styles.logoutBtn} onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <NavLink to={ROUTES.LOGIN} className={`${styles.link} ${styles.loginBtn}`}>
              Login
            </NavLink>
          )}
        </div>

        {/* ── Hamburger button ── */}
        <button
          className={styles.hamburger}
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
        >
          <span className={`${styles.bar} ${menuOpen ? styles.barOpen1 : ''}`} />
          <span className={`${styles.bar} ${menuOpen ? styles.barOpen2 : ''}`} />
          <span className={`${styles.bar} ${menuOpen ? styles.barOpen3 : ''}`} />
        </button>
      </div>

      {/* ── Mobile drawer ── */}
      <div
        className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : ''}`}
        aria-hidden={!menuOpen}
      >
        {/* Mobile search */}
        <form onSubmit={handleSearchSubmit} className={styles.mobileSearchForm}>
          <input
            type="text"
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recipes…"
            aria-label="Search recipes"
          />
          <button type="submit" className={styles.mobileSearchBtn}>
            Search
          </button>
        </form>

        <NavLink to={ROUTES.RECIPES} className={navLinkClass} end onClick={closeMenu}>
          Home
        </NavLink>
        <NavLink to={ROUTES.ADD_RECIPE} className={navLinkClass} onClick={closeMenu}>
          Add Recipe
        </NavLink>
        <NavLink to={ROUTES.CHAT} className={navLinkClass} onClick={closeMenu}>
          Chat
        </NavLink>
        <NavLink to={ROUTES.PROFILE} className={navLinkClass} onClick={closeMenu}>
          Profile{user ? ` · ${user.username}` : ''}
        </NavLink>

        {user ? (
          <button className={styles.mobileLogoutBtn} onClick={handleLogout}>
            Logout
          </button>
        ) : (
          <NavLink to={ROUTES.LOGIN} className={navLinkClass} onClick={closeMenu}>
            Login
          </NavLink>
        )}
      </div>
    </nav>
  );
}
