import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { statusAPI } from '../api/client';
import { BottomNav } from '../components/BottomNav';
import './Dashboard.css';

interface SystemStatus {
  status: string;
  uptime: number;
  memory: {
    rss: number;
    heapUsed: number;
  };
  version: string;
}

export function Dashboard() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      const data = await statusAPI.getSystem();
      setStatus(data);
    } catch (error) {
      console.error('Failed to load status:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatMemory = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>🏠 REHAU Control</h1>
      </header>

      <div className="dashboard-content">
        <div className="status-card">
          <h2>System Status</h2>
          {status && (
            <div className="status-info">
              <div className="status-item">
                <span className="label">Status:</span>
                <span className={`value status-${status.status}`}>
                  {status.status === 'running' ? '✅ Running' : '❌ Stopped'}
                </span>
              </div>
              <div className="status-item">
                <span className="label">Uptime:</span>
                <span className="value">{formatUptime(status.uptime)}</span>
              </div>
              <div className="status-item">
                <span className="label">Memory:</span>
                <span className="value">{formatMemory(status.memory.heapUsed)}</span>
              </div>
              <div className="status-item">
                <span className="label">Version:</span>
                <span className="value">{status.version}</span>
              </div>
            </div>
          )}
        </div>

        <div className="quick-actions">
          <h2>Quick Actions</h2>
          <div className="action-grid">
            <button className="action-btn" onClick={() => navigate('/zones')}>
              <span className="action-icon">🌡️</span>
              <span className="action-label">View Zones</span>
            </button>
            <button className="action-btn" onClick={() => navigate('/system')}>
              <span className="action-icon">📊</span>
              <span className="action-label">System Info</span>
            </button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
