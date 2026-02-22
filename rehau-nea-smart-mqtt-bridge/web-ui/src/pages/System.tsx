import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { BottomNav } from '../components/BottomNav';
import { Activity, Wrench, Cloud, FileText, Flame, CheckCircle, Circle } from 'lucide-react';
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
    setTemperature: number | null;
    supplyTemperature: number | null;
    returnTemperature: number | null;
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
  const navigate = useNavigate();

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
        <div className="header-content">
          <Activity size={24} />
          <h1>System Details</h1>
          <div className="install-name">{data.installation.name}</div>
        </div>
      </header>

      <div className="system-content">
        <div className="system-card">
          <h2><Wrench size={20} style={{ display: 'inline', marginRight: '8px' }} />System Tools</h2>
          <button className="tool-button" onClick={() => navigate('/logs')}>
            <FileText size={24} className="tool-icon" />
            <div className="tool-info">
              <span className="tool-title">View System Logs</span>
              <span className="tool-description">View, filter, and download system logs</span>
            </div>
            <span className="tool-arrow">→</span>
          </button>
        </div>

        {data.installation.outdoorTemperature !== undefined && (
          <div className="system-card">
            <h2><Cloud size={20} style={{ display: 'inline', marginRight: '8px' }} />Outdoor Temperature</h2>
            <div className="outdoor-temp-display">
              {data.installation.outdoorTemperature.toFixed(1)}°C
            </div>
          </div>
        )}

        <div className="system-card">
          <h2><Wrench size={20} style={{ display: 'inline', marginRight: '8px' }} />Mixed Circuits</h2>
          {data.mixedCircuits.map((circuit) => (
            <div key={circuit.number} className="circuit-item">
              <div className="circuit-header">
                <h3>Circuit {circuit.number}</h3>
                <span className={`pump-status ${circuit.pumpOn ? 'on' : 'off'}`}>
                  {circuit.pumpOn ? <><CheckCircle size={16} style={{ display: 'inline', marginRight: '4px' }} />Pump ON</> : <><Circle size={16} style={{ display: 'inline', marginRight: '4px' }} />Pump OFF</>}
                </span>
              </div>
              <div className="circuit-data">
                <div className="data-item">
                  <span className="data-label">Set</span>
                  <span className="data-value">
                    {circuit.setTemperature !== null ? `${circuit.setTemperature}°C` : '-'}
                  </span>
                </div>
                <div className="data-item">
                  <span className="data-label">Supply</span>
                  <span className="data-value">
                    {circuit.supplyTemperature !== null ? `${circuit.supplyTemperature}°C` : '-'}
                  </span>
                </div>
                <div className="data-item">
                  <span className="data-label">Return</span>
                  <span className="data-value">
                    {circuit.returnTemperature !== null ? `${circuit.returnTemperature}°C` : '-'}
                  </span>
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
          <h2><Flame size={20} style={{ display: 'inline', marginRight: '8px' }} />Zone Demands</h2>
          {data.zones.map((zone, index) => (
            <div key={index} className="zone-demand-item">
              <div className="zone-demand-header">
                <span className="zone-name">{zone.name}</span>
                <span className={`demand-status ${zone.demandState ? 'active' : 'inactive'}`}>
                  {zone.demandState ? <><Flame size={16} style={{ display: 'inline', marginRight: '4px' }} />Heating</> : <><CheckCircle size={16} style={{ display: 'inline', marginRight: '4px' }} />Satisfied</>}
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
