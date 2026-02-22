import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { BottomNav } from '../components/BottomNav';
import './System.css';

interface SystemData {
  installation: {
    name: string;
    mode: string;
    outdoorTemperature?: number;
  };
  mixedCircuits: Array<{
    number: number;
    pumpOn: boolean;
    setTemperature: number;
    supplyTemperature: number;
    returnTemperature: number;
    valveOpening: number;
  }>;
  zones: Array<{
    name: string;
    temperature: number;
    targetTemperature: number;
    demand: number;
    demandState: boolean;
  }>;
}

export function System() {
  const [data, setData] = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const response = await apiClient.get('/system/details');
      setData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load system data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="system-container">
        <div className="loading">Loading system data...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="system-container">
        <div className="error-message">{error || 'No data available'}</div>
        <p className="hint">System details endpoint coming soon</p>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="system-container">
      <header className="system-header">
        <h1>📊 System Details</h1>
        <div className="install-name">{data.installation.name}</div>
      </header>

      <div className="system-content">
        {data.installation.outdoorTemperature !== undefined && (
          <div className="system-card">
            <h2>🌤️ Outdoor Temperature</h2>
            <div className="outdoor-temp-display">
              {data.installation.outdoorTemperature.toFixed(1)}°C
            </div>
          </div>
        )}

        <div className="system-card">
          <h2>🔧 Mixed Circuits</h2>
          {data.mixedCircuits.map((circuit) => (
            <div key={circuit.number} className="circuit-item">
              <div className="circuit-header">
                <h3>Circuit {circuit.number}</h3>
                <span className={`pump-status ${circuit.pumpOn ? 'on' : 'off'}`}>
                  {circuit.pumpOn ? '🟢 Pump ON' : '⚫ Pump OFF'}
                </span>
              </div>
              <div className="circuit-data">
                <div className="data-item">
                  <span className="data-label">Set</span>
                  <span className="data-value">{circuit.setTemperature}°C</span>
                </div>
                <div className="data-item">
                  <span className="data-label">Supply</span>
                  <span className="data-value">{circuit.supplyTemperature}°C</span>
                </div>
                <div className="data-item">
                  <span className="data-label">Return</span>
                  <span className="data-value">{circuit.returnTemperature}°C</span>
                </div>
                <div className="data-item">
                  <span className="data-label">Valve</span>
                  <span className="data-value">{circuit.valveOpening}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="system-card">
          <h2>🔥 Zone Demands</h2>
          {data.zones.map((zone, index) => (
            <div key={index} className="zone-demand-item">
              <div className="zone-demand-header">
                <span className="zone-name">{zone.name}</span>
                <span className={`demand-status ${zone.demandState ? 'active' : 'inactive'}`}>
                  {zone.demandState ? '🔥 Heating' : '✓ Satisfied'}
                </span>
              </div>
              <div className="zone-demand-data">
                <div className="demand-bar-container">
                  <div 
                    className="demand-bar" 
                    style={{ width: `${zone.demand}%` }}
                  />
                </div>
                <span className="demand-value">{zone.demand}%</span>
              </div>
              <div className="zone-temps">
                <span>{zone.temperature.toFixed(1)}°C</span>
                <span>→</span>
                <span>{zone.targetTemperature > 0 ? `${zone.targetTemperature.toFixed(1)}°C` : 'Off'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
