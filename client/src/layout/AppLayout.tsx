import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import styles from './AppLayout.module.css';

export function AppLayout() {
  return (
    <div className={styles.shell}>
      <Navbar />
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
