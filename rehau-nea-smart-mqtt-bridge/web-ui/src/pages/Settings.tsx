import { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { BottomNav } from '../components/BottomNav';
import './Settings.css';

interface Config {
  api: {
    enabled: boolean;
    port: number;
    webUIEnabled: boolean;
    swaggerUrl: string;
  };
  mqtt: {
    host: string;
    port: number;
    hasAuth: boolean;
  };
  rehau: {
    email: string;
    hasPassword: boolean;
  };
  intervals: {
    zoneReload: number;
    tokenRefresh: number;
    referentialsReload: number;
    liveData: number;
  };
  commands: {
    retryTimeout: number;
    maxRetries: number;
    disableRedundant: boolean;
  };
  logging: {
    level: string;
  };
  display: {
    useGroupInNames: boolean;
  };
  pop3: {
    enabled: boolean;
    email: string;
    host: string;
    port: number;
    secure: boolean;
    ignoreTLSErrors: boolean;
    debug: boolean;
    timeout: number;
    fromAddress: string;
  };
  playwright: {
    headless: boolean;
    idleTimeout: number;
  };
  monitoring: {
    memoryWarningMB: number;
    stalenessWarningMs: number;
    stalenessStaleMs: number;
  };
  testing: {
    forceTokenExpired: boolean;
    simulateDisconnectAfter: number;
    forceFreshLogin: boolean;
  };
}

export function Settings() {
  const { darkMode, toggleDarkMode } = useTheme();
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      console.log('[Settings] Loading config from /config');
      const response = await apiClient.get<Config>('/config');
      console.log('[Settings] Config loaded:', response.data);
      setConfig(response.data);
    } catch (error) {
      console.error('[Settings] Failed to load config:', error);
      // Show error to user
      alert('Failed to load configuration. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatSeconds = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const formatMs = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return formatSeconds(Math.floor(ms / 1000));
  };

  return (
    <div className="settings-container">
      <header className="settings-header">
        <h1>⚙️ Settings</h1>
      </header>

      <div className="settings-content">
        <div className="settings-section">
          <h2>Appearance</h2>
          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-label">Dark Mode</span>
              <span className="setting-description">
                {darkMode ? 'Dark theme enabled' : 'Light theme enabled'}
              </span>
            </div>
            <button className="theme-toggle-btn" onClick={toggleDarkMode}>
              {darkMode ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="settings-section">
            <p>Loading configuration...</p>
          </div>
        ) : config ? (
          <>
            <div className="settings-section">
              <h2>API & Web UI</h2>
              <div className="setting-item">
                <span className="setting-label">API Status</span>
                <span className="setting-value">{config.api.enabled ? '✅ Enabled' : '❌ Disabled'}</span>
              </div>
              <div className="setting-item">
                <span className="setting-label">Web UI Status</span>
                <span className="setting-value">{config.api.webUIEnabled ? '✅ Enabled' : '❌ Disabled'}</span>
              </div>
              <div className="setting-item">
                <span className="setting-label">Port</span>
                <span className="setting-value">{config.api.port}</span>
              </div>
              <div className="setting-item">
                <div className="setting-info">
                  <span className="setting-label">Swagger Documentation</span>
                  <a 
                    href={config.api.swaggerUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="setting-link"
                  >
                    Open API Docs →
                  </a>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <h2>MQTT Broker</h2>
              <div className="setting-item">
                <span className="setting-label">Host</span>
                <span className="setting-value">{config.mqtt.host}</span>
              </div>
              <div className="setting-item">
                <span className="setting-label">Port</span>
                <span className="setting-value">{config.mqtt.port}</span>
              </div>
              <div className="setting-item">
                <span className="setting-label">Authentication</span>
                <span className="setting-value">{config.mqtt.hasAuth ? '✅ Configured' : '❌ None'}</span>
              </div>
            </div>

            <div className="settings-section">
              <h2>REHAU Account</h2>
              <div className="setting-item">
                <span className="setting-label">Email</span>
                <span className="setting-value">{config.rehau.email}</span>
              </div>
              <div className="setting-item">
                <span className="setting-label">Password</span>
                <span className="setting-value">{config.rehau.hasPassword ? '✅ Set' : '❌ Not set'}</span>
              </div>
            </div>

            <div className="settings-section">
              <h2>Polling Intervals</h2>
              <div className="setting-item">
                <span className="setting-label">Zone Reload</span>
                <span className="setting-value">{formatSeconds(config.intervals.zoneReload)}</span>
              </div>
              <div className="setting-item">
                <span className="setting-label">Token Refresh</span>
                <span className="setting-value">{formatSeconds(config.intervals.tokenRefresh)}</span>
              </div>
              <div className="setting-item">
                <span className="setting-label">Referentials Reload</span>
                <span className="setting-value">{formatSeconds(config.intervals.referentialsReload)}</span>
              </div>
              <div className="setting-item">
                <span className="setting-label">Live Data</span>
                <span className="setting-value">{formatSeconds(config.intervals.liveData)}</span>
              </div>
            </div>

            <div className="settings-section">
              <h2>Commands</h2>
              <div className="setting-item">
                <span className="setting-label">Retry Timeout</span>
                <span className="setting-value">{config.commands.retryTimeout}s</span>
              </div>
              <div className="setting-item">
                <span className="setting-label">Max Retries</span>
                <span className="setting-value">{config.commands.maxRetries}</span>
              </div>
              <div className="setting-item">
                <span className="setting-label">Disable Redundant</span>
                <span className="setting-value">{config.commands.disableRedundant ? '✅ Yes' : '❌ No'}</span>
              </div>
            </div>

            <div className="settings-section">
              <h2>Logging</h2>
              <div className="setting-item">
                <span className="setting-label">Log Level</span>
                <span className="setting-value">{config.logging.level.toUpperCase()}</span>
              </div>
            </div>

            <div className="settings-section">
              <h2>POP3 (OAuth2)</h2>
              <div className="setting-item">
                <span className="setting-label">Status</span>
                <span className="setting-value">{config.pop3.enabled ? '✅ Enabled' : '❌ Disabled'}</span>
              </div>
              {config.pop3.enabled && (
                <>
                  <div className="setting-item">
                    <span className="setting-label">Email</span>
                    <span className="setting-value">{config.pop3.email}</span>
                  </div>
                  <div className="setting-item">
                    <span className="setting-label">Host</span>
                    <span className="setting-value">{config.pop3.host}:{config.pop3.port}</span>
                  </div>
                  <div className="setting-item">
                    <span className="setting-label">Secure</span>
                    <span className="setting-value">{config.pop3.secure ? '✅ Yes' : '❌ No'}</span>
                  </div>
                  <div className="setting-item">
                    <span className="setting-label">Ignore TLS Errors</span>
                    <span className="setting-value">{config.pop3.ignoreTLSErrors ? '✅ Yes' : '❌ No'}</span>
                  </div>
                  <div className="setting-item">
                    <span className="setting-label">Debug Mode</span>
                    <span className="setting-value">{config.pop3.debug ? '✅ Enabled' : '❌ Disabled'}</span>
                  </div>
                  <div className="setting-item">
                    <span className="setting-label">Timeout</span>
                    <span className="setting-value">{formatMs(config.pop3.timeout)}</span>
                  </div>
                  <div className="setting-item">
                    <span className="setting-label">From Address</span>
                    <span className="setting-value">{config.pop3.fromAddress}</span>
                  </div>
                </>
              )}
            </div>

            <div className="settings-section">
              <h2>Playwright Browser</h2>
              <div className="setting-item">
                <span className="setting-label">Headless Mode</span>
                <span className="setting-value">{config.playwright.headless ? '✅ Yes' : '❌ No'}</span>
              </div>
              <div className="setting-item">
                <span className="setting-label">Idle Timeout</span>
                <span className="setting-value">{formatSeconds(config.playwright.idleTimeout)}</span>
              </div>
            </div>

            <div className="settings-section">
              <h2>Monitoring</h2>
              <div className="setting-item">
                <span className="setting-label">Memory Warning</span>
                <span className="setting-value">{config.monitoring.memoryWarningMB} MB</span>
              </div>
              <div className="setting-item">
                <span className="setting-label">Staleness Warning</span>
                <span className="setting-value">{formatMs(config.monitoring.stalenessWarningMs)}</span>
              </div>
              <div className="setting-item">
                <span className="setting-label">Staleness Stale</span>
                <span className="setting-value">{formatMs(config.monitoring.stalenessStaleMs)}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="settings-section">
            <p>Failed to load configuration. Please check the console for errors.</p>
          </div>
        )}

        <div className="settings-section">
          <h2>Account</h2>
          <div className="setting-item">
            <button className="logout-btn" onClick={handleLogout}>
              🚪 Logout
            </button>
          </div>
        </div>

        <div className="settings-section">
          <h2>About</h2>
          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-label">Version</span>
              <span className="setting-value">5.0.0</span>
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-label">REHAU NEA Smart 2.0</span>
              <span className="setting-description">
                MQTT Bridge & Web Interface
              </span>
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-label">Author</span>
              <span className="setting-value">Manuele Cappelleri</span>
              <span className="setting-description">info@domodreams.it</span>
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-label">Project Home</span>
              <a 
                href="https://github.com/manuxio/rehau-nea-smart-2-home-assistant" 
                target="_blank" 
                rel="noopener noreferrer"
                className="setting-link"
              >
                GitHub Repository →
              </a>
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-label">REHAU</span>
              <a 
                href="https://www.rehau.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="setting-link"
              >
                www.rehau.com →
              </a>
              <span className="setting-description">
                This project is not affiliated with REHAU
              </span>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
