import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { BottomNav } from '../components/BottomNav';
import './Zones.css';

interface Zone {
  id: string;
  name: string;
  temperature: number;
  targetTemperature: number;
  humidity: number;
  mode: string;
  preset: string;
}

export function Zones() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadZones();
  }, []);

  const loadZones = async () => {
    try {
      const response = await apiClient.get('/zones');
      setZones(response.data.zones || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load zones');
    } finally {
      setLoading(false);
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

  return (
    <div className="zones-container">
      <h1>🌡️ Zones</h1>
      
      {zones.length === 0 ? (
        <div className="empty-state">
          <p>No zones found</p>
          <p className="hint">Zones will appear here once the system is configured</p>
        </div>
      ) : (
        <div className="zones-grid">
          {zones.map((zone) => (
            <div key={zone.id} className="zone-card">
              <div className="zone-header">
                <h3>{zone.name}</h3>
                <span className={`mode-badge mode-${zone.mode}`}>
                  {zone.mode}
                </span>
              </div>
              
              <div className="zone-temp">
                <div className="current-temp">
                  <span className="temp-value">{zone.temperature}°</span>
                  <span className="temp-label">Current</span>
                </div>
                <div className="temp-arrow">→</div>
                <div className="target-temp">
                  <span className="temp-value">{zone.targetTemperature}°</span>
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
                  <span>{zone.preset}</span>
                </div>
              </div>
              
              <button className="zone-control-btn">
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
