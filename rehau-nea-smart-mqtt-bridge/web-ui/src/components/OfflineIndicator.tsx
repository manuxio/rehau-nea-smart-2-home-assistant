/**
 * Offline Indicator Component
 * Shows when the app is offline
 */

import { usePWA } from '../hooks/usePWA';

export function OfflineIndicator() {
  const { isOnline } = usePWA();

  if (isOnline) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: '#ff6b6b',
      color: 'white',
      padding: '8px',
      textAlign: 'center',
      fontSize: '14px',
      fontWeight: '500',
      zIndex: 9999,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
    }}>
      <span style={{ marginRight: '8px' }}>📡</span>
      No internet connection - Working offline
    </div>
  );
}
