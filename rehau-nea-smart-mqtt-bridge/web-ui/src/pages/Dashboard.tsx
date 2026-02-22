import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, statusAPI } from '../api/client';
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

interface SystemStats {
  uptime: number;
  uptimeFormatted: string;
  tokenRefreshCount: number;
  fullAuthCount: number;
  startTime: number;
}

interface Installation {
  name: string;
}

interface SystemStatusExtended {
  outdoorTemperature?: number;
}

export function Dashboard() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [installation, setInstallation] = useState<Installation | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatusExtended>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [statusData, statsData, installData, sysStatusData] = await Promise.all([
        statusAPI.getSystem(),
        apiClient.get('/stats'),
        apiClient.get('/installations'),
        apiClient.get('/status/system').catch(() => ({ data: {} }))
      ]);
      setStatus(statusData);
      setStats(statsData.data);
      setSystemStatus(sysStatusData.data || {});
      if (installData.data.installations && installData.data.installations.length > 0) {
        setInstallation({ name: installData.data.installations[0].name });
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
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
        <div className="header-content">
          <h1>🏠 BetteRehau</h1>
          {installation && <span className="install-name">{installation.name}</span>}
        </div>
        {systemStatus.outdoorTemperature !== undefined && 
         systemStatus.outdoorTemperature >= -30 && 
         systemStatus.outdoorTemperature <= 70 && (
          <div className="outdoor-temp">
            🌤️ {systemStatus.outdoorTemperature.toFixed(1)}°C
          </div>
        )}
      </header>

      <div className="dashboard-content">
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
                <span className="value">{stats?.uptimeFormatted || 'N/A'}</span>
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

        {stats && (
          <div className="status-card">
            <h2>Authentication Statistics</h2>
            <div className="status-info">
              <div className="status-item">
                <span className="label">Full Authentications:</span>
                <span className="value">{stats.fullAuthCount}</span>
              </div>
              <div className="status-item">
                <span className="label">Token Refreshes:</span>
                <span className="value">{stats.tokenRefreshCount}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
