import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Thermometer, Activity, Settings } from 'lucide-react';
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
        <Home size={22} className="nav-icon" />
        <span className="nav-label">Dashboard</span>
      </button>
      
      <button
        className={`nav-item ${isActive('/zones') ? 'active' : ''}`}
        onClick={() => navigate('/zones')}
      >
        <Thermometer size={22} className="nav-icon" />
        <span className="nav-label">Zones</span>
      </button>
      
      <button
        className={`nav-item ${isActive('/system') ? 'active' : ''}`}
        onClick={() => navigate('/system')}
      >
        <Activity size={22} className="nav-icon" />
        <span className="nav-label">System</span>
      </button>
      
      <button
        className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
        onClick={() => navigate('/settings')}
      >
        <Settings size={22} className="nav-icon" />
        <span className="nav-label">Settings</span>
      </button>
    </nav>
  );
}
