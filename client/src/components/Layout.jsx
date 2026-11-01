import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { FiCamera, FiGrid, FiClock, FiLink, FiZap, FiLogOut, FiLogIn } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { Tile } from './ui';

export default function Layout() {
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(y > 24);
      setProgress(max > 0 ? Math.min(y / max, 1) : 0);
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  const links = user
    ? [
        ['/dashboard', 'Dashboard', FiGrid],
        ['/history', 'Post History', FiClock],
        ['/connect', 'Connect Accounts', FiLink],
      ]
    : [['/dashboard', 'Dashboard', FiGrid]];
  return (
    <div className="app">
      <div className={`nav-wrap ${scrolled ? 'scrolled' : ''}`}>
      <header className="nav">
        <Link to="/dashboard" className="brand">
          <Tile icon={FiCamera} size={40} /> AURA PRO
        </Link>
        <nav className="nav-links">
          {links.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
        <span className="pill">
          <FiZap size={16} /> AI Vision Ready
        </span>
        {user ? (
          <>
            <button className="avatar" onClick={logout} title="Sign out" aria-label="Sign out">
              {user.avatar ? <img src={user.avatar} alt="" /> : (user.name || 'A')[0].toUpperCase()}
            </button>
            <button className="icon-btn" onClick={logout} aria-label="Sign out">
              <FiLogOut size={18} />
            </button>
          </>
        ) : (
          <Link to="/login" state={{ from: '/dashboard' }} className="btn primary">
            <FiLogIn size={18} /> Sign in
          </Link>
        )}
        <span className="nav-progress" style={{ transform: `scaleX(${progress})` }} />
      </header>
      </div>
      <main className="main">
        <Outlet />
      </main>
      <footer className="foot">© 2025 Aura Pro AI. All rights reserved.</footer>
    </div>
  );
}
