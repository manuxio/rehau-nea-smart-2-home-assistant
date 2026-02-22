import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { BottomNav } from '../components/BottomNav';
import './Logs.css';

interface LogsResponse {
  mode: string;
  lines: number;
  logs: string[];
}

export function Logs() {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'normal' | 'shareable'>('normal');
  const [level, setLevel] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    loadLogs();
    
    let interval: ReturnType<typeof setInterval> | undefined;
    if (autoRefresh) {
      interval = setInterval(loadLogs, 5000); // Refresh every 5 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mode, level, autoRefresh]);

  const loadLogs = async () => {
    try {
      const params = new URLSearchParams({
        mode,
        lines: '100'
      });
      
      if (level !== 'all') {
        params.append('level', level);
      }

      const response = await apiClient.get<LogsResponse>(`/logs?${params.toString()}`);
      // Strip ANSI color codes from logs
      const cleanedLogs = response.data.logs.map(log => 
        log.replace(/\x1b\[[0-9;]*m/g, '')
      );
      setLogs(cleanedLogs);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadLogs = async () => {
    try {
      const response = await apiClient.post('/logs/export', {
        mode,
        lines: 500
      }, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/gzip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `betterehau-logs-${mode}-${new Date().toISOString().split('T')[0]}.log.gz`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download logs:', error);
      alert('Failed to download logs. Please try again.');
    }
  };

  const getLogClass = (log: string): string => {
    if (log.includes('[ERROR]') || log.includes('❌')) return 'log-error';
    if (log.includes('[WARN]') || log.includes('⚠️')) return 'log-warn';
    if (log.includes('[DEBUG]') || log.includes('🔍')) return 'log-debug';
    return 'log-info';
  };

  if (loading) {
    return (
      <div className="logs-container">
        <div className="loading">Loading logs...</div>
      </div>
    );
  }

  return (
    <div className="logs-container">
      <header className="logs-header">
        <div className="header-content">
          <h1>📋 System Logs</h1>
        </div>
      </header>

      <div className="logs-content-wrapper">
        <div className="logs-card">
          <h2>Log Viewer</h2>
          
          <div className="logs-controls">
            <div className="control-group">
              <label>Mode</label>
              <select value={mode} onChange={(e) => setMode(e.target.value as 'normal' | 'shareable')}>
                <option value="normal">Normal (Real Names)</option>
                <option value="shareable">Shareable (Obfuscated)</option>
              </select>
            </div>

            <div className="control-group">
              <label>Level</label>
              <select value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="all">All Levels</option>
                <option value="error">Error</option>
                <option value="warn">Warning</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
            </div>

            <div className="control-group">
              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="auto-refresh"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                <label htmlFor="auto-refresh">Auto-refresh (5s)</label>
              </div>
            </div>
          </div>

          <div className="logs-actions">
            <button className="btn-download" onClick={downloadLogs}>
              💾 Download Logs
            </button>
            <button className="btn-refresh" onClick={loadLogs}>
              🔄 Refresh
            </button>
          </div>

          <div className="logs-info">
            <span>Showing {logs.length} recent log entries</span>
            {mode === 'shareable' && (
              <span className="privacy-notice">
                🔒 Personal information is obfuscated
              </span>
            )}
          </div>

          <div className="logs-viewer">
            {logs.length === 0 ? (
              <div className="no-logs">
                {loading ? 'Loading logs...' : 'No logs available yet. Logs will appear here once the system starts generating them.'}
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className={`log-line ${getLogClass(log)}`}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
