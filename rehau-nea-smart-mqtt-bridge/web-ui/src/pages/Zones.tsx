import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { BottomNav } from '../components/BottomNav';
import { useNavigate } from 'react-router-dom';
import { Thermometer, Droplets, Home, Moon, Pause } from 'lucide-react';
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
    if (!temp || temp <= 0) return 'Off';
    return `${temp.toFixed(1)}°C`;
  };

  const getPresetLabel = (preset: string) => {
    const labels: Record<string, string> = {
      'comfort': 'Comfort',
      'reduced': 'Reduced',
      'standby': 'Standby',
      'off': 'Off'
    };
    return labels[preset] || preset;
  };

  const getPresetIcon = (preset: string) => {
    switch(preset) {
      case 'comfort': return <Home size={16} />;
      case 'reduced': return <Moon size={16} />;
      case 'standby': return <Pause size={16} />;
      default: return null;
    }
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
        <div className="header-content">
          <Thermometer size={24} />
          <h1>Zones</h1>
          <span className="install-name">{installName}</span>
        </div>
        {systemStatus.outdoorTemperature !== undefined && 
         systemStatus.outdoorTemperature >= -30 && 
         systemStatus.outdoorTemperature <= 70 && (
          <div className="outdoor-temp">
            {systemStatus.outdoorTemperature.toFixed(1)}°C
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
                <div className="temp-display-simple">
                  <div className="temp-value">{zone.temperature.toFixed(1)}</div>
                  <div className="temp-unit">°C</div>
                </div>
              </div>
              
              <div className="zone-info">
                <div className="info-item">
                  <span className="info-label">Target</span>
                  <span className="info-value">{formatTemperature(zone.targetTemperature)}</span>
                </div>
                <div className="info-item">
                  <Droplets size={16} className="info-icon" />
                  <span className="info-value">{zone.humidity}%</span>
                </div>
              </div>
              
              <div className="preset-display">
                {getPresetIcon(zone.preset)}
                <span className="preset-text">{getPresetLabel(zone.preset)}</span>
              </div>
              
              <button 
                className="zone-control-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/zone/${zone.id}`);
                }}
              >
                Adjust
              </button>
            </div>
          ))}
        </div>
      )}
      
      <BottomNav />
    </div>
  );
}
