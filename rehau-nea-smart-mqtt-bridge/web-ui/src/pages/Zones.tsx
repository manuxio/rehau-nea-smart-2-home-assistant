import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { BottomNav } from '../components/BottomNav';
import { useNavigate } from 'react-router-dom';
import './Zones.css';

interface Zone {
  id: string;
  name: string;
  temperature: number;
  targetTemperature: number;
  humidity: number;
  mode: string;
  preset: string;
  installName: string;
}

interface SystemStatus {
  outdoorTemperature?: number;
}

export function Zones() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({});
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [zonesResponse, statusResponse] = await Promise.all([
        apiClient.get('/zones'),
        apiClient.get('/status/system').catch(() => ({ data: {} }))
      ]);
      setZones(zonesResponse.data.zones || []);
      setSystemStatus(statusResponse.data || {});
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load zones');
    } finally {
      setLoading(false);
    }
  };

  const formatTemperature = (temp: number) => {
    if (temp <= 0) return '-';
    return `${temp.toFixed(1)}°`;
  };

  const getPresetLabel = (preset: string) => {
    const labels: Record<string, string> = {
      'comfort': '🏠 Comfort',
      'reduced': '🌙 Reduced',
      'standby': '⏸️ Standby',
      'off': '⏹️ Off'
    };
    return labels[preset] || preset;
  };

  if (loading) {
    return (
      <div className="zones-container">
        <div className="loading">Loading zones...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="zones-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  const installName = zones[0]?.installName || 'REHAU';

  return (
    <div className="zones-container">
      <div className="zones-header">
        <h1>🌡️ {installName}</h1>
        {systemStatus.outdoorTemperature !== undefined && (
          <div className="outdoor-temp">
            🌤️ {systemStatus.outdoorTemperature.toFixed(1)}°C
          </div>
        )}
      </div>
      
      {zones.length === 0 ? (
        <div className="empty-state">
          <p>No zones found</p>
          <p className="hint">Zones will appear here once the system is configured</p>
        </div>
      ) : (
        <div className="zones-grid">
          {zones.map((zone) => (
            <div 
              key={zone.id} 
              className="zone-card"
              onClick={() => navigate(`/zone/${zone.id}`)}
            >
              <div className="zone-header">
                <h3>{zone.name}</h3>
                <span className={`mode-badge mode-${zone.mode}`}>
                  {zone.mode}
                </span>
              </div>
              
              <div className="zone-temp">
                <div className="current-temp">
                  <span className="temp-value">{zone.temperature.toFixed(1)}°</span>
                  <span className="temp-label">Current</span>
                </div>
                <div className="temp-arrow">→</div>
                <div className="target-temp">
                  <span className="temp-value">{formatTemperature(zone.targetTemperature)}</span>
                  <span className="temp-label">Target</span>
                </div>
              </div>
              
              <div className="zone-info">
                <div className="info-item">
                  <span className="info-icon">💧</span>
                  <span>{zone.humidity}%</span>
                </div>
                <div className="info-item">
                  <span className="info-icon">🎯</span>
                  <span>{getPresetLabel(zone.preset)}</span>
                </div>
              </div>
              
              <button 
                className="zone-control-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/zone/${zone.id}`);
                }}
              >
                Control
              </button>
            </div>
          ))}
        </div>
      )}
      
      <BottomNav />
    </div>
  );
}
