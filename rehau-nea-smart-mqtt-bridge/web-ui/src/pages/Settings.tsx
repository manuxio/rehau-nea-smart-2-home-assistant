import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { BottomNav } from '../components/BottomNav';
import './Settings.css';

export function Settings() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="settings-container">
      <h1>⚙️ Settings</h1>
      
      <div className="settings-section">
        <h2>About</h2>
        <div className="settings-card">
          <div className="setting-item">
            <span className="setting-label">Version</span>
            <span className="setting-value">5.0.0</span>
          </div>
          <div className="setting-item">
            <span className="setting-label">System</span>
            <span className="setting-value">REHAU NEA Smart 2.0</span>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>Account</h2>
        <div className="settings-card">
          <button onClick={handleLogout} className="logout-button">
            🚪 Logout
          </button>
        </div>
      </div>
      
      <BottomNav />
    </div>
  );
}
