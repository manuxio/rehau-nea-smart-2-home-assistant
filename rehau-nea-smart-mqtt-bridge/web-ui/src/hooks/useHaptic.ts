/**
 * Haptic Feedback Hook
 * Provides haptic feedback for touch interactions
 */

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

export function useHaptic() {
  const vibrate = (pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const haptic = (style: HapticStyle = 'light') => {
    // Check if Haptic Feedback API is available (iOS)
    if ('HapticFeedback' in window) {
      try {
        // @ts-ignore - HapticFeedback is not in TypeScript types
        window.HapticFeedback.impact({ style });
        return;
      } catch (error) {
        // Fall through to vibration API
      }
    }

    // Fallback to Vibration API
    switch (style) {
      case 'light':
        vibrate(10);
        break;
      case 'medium':
        vibrate(20);
        break;
      case 'heavy':
        vibrate(30);
        break;
      case 'selection':
        vibrate(5);
        break;
      case 'success':
        vibrate([10, 50, 10]);
        break;
      case 'warning':
        vibrate([20, 100, 20]);
        break;
      case 'error':
        vibrate([30, 100, 30, 100, 30]);
        break;
      default:
        vibrate(10);
    }
  };

  const isSupported = 'vibrate' in navigator || 'HapticFeedback' in window;

  return {
    haptic,
    vibrate,
    isSupported
  };
}
