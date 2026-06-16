import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const links = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/candidates', label: 'Candidates' },
  ];

  const isActive = (path) => location.pathname === path ? 'nav-link active' : 'nav-link';

  return (
    <nav className="navbar">
      <div className="nav-inner">
        <Link to="/dashboard" className="nav-brand">
          <span className="brand-icon">📋</span>
          Resume Screener
        </Link>
        <div className="nav-links">
          {links.map(l => (
            <Link key={l.to} to={l.to} className={isActive(l.to)}>{l.label}</Link>
          ))}
        </div>
        <div className="nav-right">
          <span className="nav-user">{user?.full_name || user?.email}</span>
          <button onClick={logout} className="btn btn-sm btn-outline">Logout</button>
        </div>
      </div>
    </nav>
  );
}
