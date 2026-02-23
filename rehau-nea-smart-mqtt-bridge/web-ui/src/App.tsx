import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Zones } from './pages/Zones';
import { ZoneDetail } from './pages/ZoneDetail';
import { System } from './pages/System';
import { Settings } from './pages/Settings';
import { Logs } from './pages/Logs';
import { ProtectedRoute } from './components/ProtectedRoute';
import { OfflineIndicator } from './components/OfflineIndicator';
import { InstallPrompt } from './components/InstallPrompt';
import { useAuthStore } from './store/authStore';
import { ThemeProvider } from './contexts/ThemeContext';
import './styles/dark-mode.css';

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Detect basename for HA ingress support
  // In HA ingress, the path is like /api/hassio_ingress/TOKEN/
  // In standalone, it's just /
  const getBasename = () => {
    const path = window.location.pathname;
    // Check if we're in HA ingress
    if (path.includes('/api/hassio_ingress/')) {
      // Extract the ingress path including the token
      const match = path.match(/^(\/api\/hassio_ingress\/[^/]+)/);
      return match ? match[1] : '/';
    }
    return '/';
  };

  const basename = getBasename();

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const swPath = `${basename}/sw.js`.replace(/\/\//g, '/');
      navigator.serviceWorker
        .register(swPath)
        .then((registration) => {
          console.log('Service Worker registered:', registration);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, [basename]);

  return (
    <ThemeProvider>
      <BrowserRouter basename={basename}>
        <OfflineIndicator />
        <InstallPrompt />
        <Routes>
          <Route 
            path="/login" 
            element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} 
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/zones"
            element={
              <ProtectedRoute>
                <Zones />
              </ProtectedRoute>
            }
          />
          <Route
            path="/zone/:id"
            element={
              <ProtectedRoute>
                <ZoneDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/system"
            element={
              <ProtectedRoute>
                <System />
              </ProtectedRoute>
            }
          />
          <Route
            path="/logs"
            element={
              <ProtectedRoute>
                <Logs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
