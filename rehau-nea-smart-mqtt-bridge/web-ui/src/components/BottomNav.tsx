import { useNavigate, useLocation } from 'react-router-dom';
import './BottomNav.css';

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bottom-nav">
      <button
        className={`nav-item ${isActive('/') ? 'active' : ''}`}
        onClick={() => navigate('/')}
      >
        <span className="nav-icon">🏠</span>
        <span className="nav-label">Dashboard</span>
      </button>
      
      <button
        className={`nav-item ${isActive('/zones') ? 'active' : ''}`}
        onClick={() => navigate('/zones')}
      >
        <span className="nav-icon">🌡️</span>
        <span className="nav-label">Zones</span>
      </button>
      
      <button
        className={`nav-item ${isActive('/system') ? 'active' : ''}`}
        onClick={() => navigate('/system')}
      >
        <span className="nav-icon">📊</span>
        <span className="nav-label">System</span>
      </button>
      
      <button
        className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
        onClick={() => navigate('/settings')}
      >
        <span className="nav-icon">⚙️</span>
        <span className="nav-label">Settings</span>
      </button>
    </nav>
  );
}
