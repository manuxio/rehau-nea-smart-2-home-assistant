/**
 * Pull to Refresh Component
 * Wraps content with pull-to-refresh functionality
 */

import type { ReactNode } from 'react';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const { isPulling, pullDistance, isRefreshing, threshold } = usePullToRefresh({
    onRefresh
  });

  const rotation = (pullDistance / threshold) * 360;

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Pull indicator */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: `${pullDistance}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-color)',
          transition: isPulling ? 'none' : 'height 0.3s ease-out',
          zIndex: 999,
          overflow: 'hidden'
        }}
      >
        {(isPulling || isRefreshing) && (
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: '3px solid var(--border-color)',
              borderTopColor: 'var(--primary-color)',
              transform: isRefreshing ? 'none' : `rotate(${rotation}deg)`,
              animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
              transition: 'transform 0.1s ease-out'
            }}
          />
        )}
      </div>

      {/* Content */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isPulling ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        {children}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
