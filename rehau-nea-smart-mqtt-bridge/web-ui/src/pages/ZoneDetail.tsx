import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import './ZoneDetail.css';

interface Zone {
  id: string;
  name: string;
  temperature: number;
  targetTemperature: number;
  humidity: number;
  mode: string;
  preset: string;
  installName: string;
  groupName: string;
}

export function ZoneDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [zone, setZone] = useState<Zone | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadZone();
    const interval = setInterval(loadZone, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [id]);

  const loadZone = async () => {
    try {
      const response = await apiClient.get(`/zones/${id}`);
      setZone(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load zone');
    } finally {
      setLoading(false);
    }
  };

  const setTemperature = async (newTemp: number) => {
    if (!zone || updating) return;
    
    setUpdating(true);
    try {
      await apiClient.put(`/zones/${id}/temperature`, { temperature: newTemp });
      // Optimistically update UI
      setZone({ ...zone, targetTemperature: newTemp });
      // Reload to get actual state
      setTimeout(loadZone, 1000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to set temperature');
    } finally {
      setUpdating(false);
    }
  };

  const setPreset = async (newPreset: string) => {
    if (!zone || updating) return;
    
    setUpdating(true);
    try {
      await apiClient.put(`/zones/${id}/preset`, { preset: newPreset });
      // Optimistically update UI
      setZone({ ...zone, preset: newPreset });
      // Reload to get actual state
      setTimeout(loadZone, 1000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to set preset');
    } finally {
      setUpdating(false);
    }
  };

  const adjustTemperature = (delta: number) => {
    if (!zone) return;
    const currentTarget = zone.targetTemperature > 0 ? zone.targetTemperature : 20;
    const newTemp = Math.round((currentTarget + delta) * 2) / 2; // Round to 0.5
    if (newTemp >= 5 && newTemp <= 35) {
      setTemperature(newTemp);
    }
  };

  if (loading) {
    return (
      <div className="zone-detail-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (error || !zone) {
    return (
      <div className="zone-detail-container">
        <div className="error-message">{error || 'Zone not found'}</div>
        <button onClick={() => navigate('/zones')} className="back-btn">
          ← Back to Zones
        </button>
      </div>
    );
  }

  const formatTemperature = (temp: number) => {
    if (temp <= 0) return 'Off';
    return `${temp.toFixed(1)}°C`;
  };

  return (
    <div className="zone-detail-container">
      <header className="zone-detail-header">
        <button onClick={() => navigate('/zones')} className="back-button">
          ← Back
        </button>
        <h1>{zone.name}</h1>
        <div className="zone-location">{zone.groupName}</div>
      </header>

      <div className="zone-detail-content">
        <div className="temperature-display">
          <div className="current-temperature">
            <div className="temp-label">Current</div>
            <div className="temp-value">{zone.temperature.toFixed(1)}°</div>
          </div>
          <div className="target-temperature">
            <div className="temp-label">Target</div>
            <div className="temp-value">{formatTemperature(zone.targetTemperature)}</div>
          </div>
        </div>

        <div className="humidity-display">
          <span className="humidity-icon">💧</span>
          <span className="humidity-value">{zone.humidity}%</span>
          <span className="humidity-label">Humidity</span>
        </div>

        <div className="control-section">
          <h2>Temperature Control</h2>
          <div className="temp-control">
            <button 
              className="temp-btn" 
              onClick={() => adjustTemperature(-0.5)}
              disabled={updating}
            >
              -
            </button>
            <span className="temp-display">{formatTemperature(zone.targetTemperature)}</span>
            <button 
              className="temp-btn" 
              onClick={() => adjustTemperature(0.5)}
              disabled={updating}
            >
              +
            </button>
          </div>
          {updating && <p className="control-hint">Updating...</p>}
        </div>

        <div className="preset-section">
          <h2>Preset Mode</h2>
          <div className="preset-buttons">
            <button 
              className={`preset-btn ${zone.preset === 'comfort' ? 'active' : ''}`}
              onClick={() => setPreset('comfort')}
              disabled={updating}
            >
              🏠 Comfort
            </button>
            <button 
              className={`preset-btn ${zone.preset === 'reduced' ? 'active' : ''}`}
              onClick={() => setPreset('reduced')}
              disabled={updating}
            >
              🌙 Reduced
            </button>
            <button 
              className={`preset-btn ${zone.preset === 'standby' ? 'active' : ''}`}
              onClick={() => setPreset('standby')}
              disabled={updating}
            >
              ⏸️ Standby
            </button>
          </div>
        </div>

        <div className="info-section">
          <h2>Zone Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">Installation</span>
              <span className="info-value">{zone.installName}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Group</span>
              <span className="info-value">{zone.groupName}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Mode</span>
              <span className="info-value">{zone.mode}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Preset</span>
              <span className="info-value">{zone.preset}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
