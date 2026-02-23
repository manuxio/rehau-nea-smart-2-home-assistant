import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { BottomNav } from '../components/BottomNav';
import { ArrowLeft, Droplets, Minus, Plus, Home, Moon, Pause, Lightbulb } from 'lucide-react';
import './ZoneDetail.css';

interface Zone {
  id: string;
  name: string;
  temperature: number;
  targetTemperature: number;
  humidity: number;
  mode: string;
  preset: string;
  ringLight: string;
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
  const [pendingTemp, setPendingTemp] = useState<number | null>(null);
  const debounceTimer = useRef<number | null>(null);

  useEffect(() => {
    loadZone();
    const interval = setInterval(loadZone, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [id]);

  // Debounced temperature setter
  useEffect(() => {
    if (pendingTemp === null) return;
    
    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // Set new timer
    debounceTimer.current = setTimeout(() => {
      sendTemperature(pendingTemp);
      setPendingTemp(null);
    }, 1000); // 1 second debounce
    
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [pendingTemp]);

  const loadZone = async () => {
    try {
      const response = await apiClient.get(`/zones/${id}`);
      console.log('Zone data received:', response.data);
      setZone(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load zone');
    } finally {
      setLoading(false);
    }
  };

  const sendTemperature = async (newTemp: number) => {
    if (!zone) return;
    
    setUpdating(true);
    try {
      await apiClient.put(`/zones/${id}/temperature`, { temperature: newTemp });
      // Reload to get actual state
      setTimeout(loadZone, 2000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to set temperature');
      loadZone(); // Reload on error
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
      setTimeout(loadZone, 2000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to set preset');
      loadZone(); // Reload on error
    } finally {
      setUpdating(false);
    }
  };

  const toggleRingLight = async () => {
    if (!zone || updating) return;
    
    console.log('=== Ring Light Toggle ===');
    console.log('Current zone.ringLight:', zone.ringLight);
    console.log('Type:', typeof zone.ringLight);
    
    const newState = zone.ringLight === 'ON' ? 'off' : 'on';
    console.log('Calculated newState:', newState);
    console.log('Will send to API:', newState);
    
    setUpdating(true);
    try {
      const response = await apiClient.put(`/zones/${id}/ring-light`, { state: newState });
      console.log('API response:', response.data);
      
      // Optimistically update UI
      const optimisticState = newState.toUpperCase();
      console.log('Optimistic update to:', optimisticState);
      setZone({ ...zone, ringLight: optimisticState });
      
      // Reload to get actual state
      setTimeout(() => {
        console.log('Reloading zone data...');
        loadZone();
      }, 2000);
    } catch (err: any) {
      console.error('Ring light toggle error:', err);
      alert(err.response?.data?.error || 'Failed to toggle ring light');
      loadZone(); // Reload on error
    } finally {
      setUpdating(false);
    }
  };

  const adjustTemperature = (delta: number) => {
    if (!zone || zone.preset === 'standby') return;
    const currentTarget = getDisplayTemp();
    const newTemp = Math.round((currentTarget + delta) * 2) / 2; // Round to 0.5
    if (newTemp >= 5 && newTemp <= 35) {
      setPendingTemp(newTemp);
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

  const getDisplayTemp = () => {
    if (pendingTemp !== null) return pendingTemp;
    if (zone && zone.targetTemperature > 0) return zone.targetTemperature;
    return 20;
  };

  return (
    <div className="zone-detail-container">
      <header className="zone-detail-header">
        <button onClick={() => navigate('/zones')} className="back-button">
          <ArrowLeft size={20} />
        </button>
        <h1>{zone.name}</h1>
      </header>

      <div className="zone-detail-content">
        <div className="temperature-display">
          <div className="temp-main">
            <div className="temp-label">Current Temperature</div>
            <div className="temp-value-large">
              {zone.temperature.toFixed(1)}<span className="temp-unit-large">°C</span>
            </div>
            {zone.preset !== 'standby' && zone.targetTemperature > 0 && (
              <div className="temp-target-info">
                Target: {zone.targetTemperature.toFixed(1)}°C
              </div>
            )}
            {zone.preset === 'standby' && (
              <div className="temp-target-info">
                Standby Mode
              </div>
            )}
          </div>
        </div>

        <div className="humidity-display">
          <Droplets size={20} className="humidity-icon" />
          <span className="humidity-value">{zone.humidity}%</span>
          <span className="humidity-label">Humidity</span>
        </div>

        <div className="control-section">
          <h2>Temperature Control</h2>
          {zone.preset === 'standby' ? (
            <p className="control-hint disabled-message">
              Temperature control is disabled in Standby mode. Switch to Comfort or Reduced to adjust temperature.
            </p>
          ) : (
            <>
              <div className="temp-control">
                <button 
                  className="temp-btn" 
                  onClick={() => adjustTemperature(-0.5)}
                  disabled={updating}
                >
                  <Minus size={20} />
                </button>
                <span className="temp-display">{getDisplayTemp().toFixed(1)}°C</span>
                <button 
                  className="temp-btn" 
                  onClick={() => adjustTemperature(0.5)}
                  disabled={updating}
                >
                  <Plus size={20} />
                </button>
              </div>
              {updating && <p className="control-hint">Updating...</p>}
            </>
          )}
        </div>

        <div className="preset-section">
          <h2>Preset Mode</h2>
          <div className="preset-buttons">
            <button 
              className={`preset-btn ${zone.preset === 'comfort' ? 'active' : ''}`}
              onClick={() => setPreset('comfort')}
              disabled={updating}
            >
              <Home size={18} />
              <span>Comfort</span>
            </button>
            <button 
              className={`preset-btn ${zone.preset === 'reduced' ? 'active' : ''}`}
              onClick={() => setPreset('reduced')}
              disabled={updating}
            >
              <Moon size={18} />
              <span>Reduced</span>
            </button>
            <button 
              className={`preset-btn ${zone.preset === 'standby' ? 'active' : ''}`}
              onClick={() => setPreset('standby')}
              disabled={updating}
            >
              <Pause size={18} />
              <span>Standby</span>
            </button>
          </div>
        </div>

        <div className="ring-light-section">
          <h2>Ring Light</h2>
          <button 
            className={`ring-light-btn ${zone.ringLight === 'ON' ? 'active' : ''}`}
            onClick={toggleRingLight}
            disabled={updating}
          >
            <Lightbulb size={18} />
            <span>{zone.ringLight === 'ON' ? 'Turn Off' : 'Turn On'}</span>
          </button>
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

      <BottomNav />
    </div>
  );
}
