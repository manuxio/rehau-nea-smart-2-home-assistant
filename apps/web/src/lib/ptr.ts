import { useEffect, useRef, useState } from "react";

/**
 * Tiny pull-to-refresh helper. Watches touch events on `window`; when the page
 * is scrolled to the top and the user drags down past `threshold`, calls
 * `onRefresh()`. Returns a small CSS offset so the UI can show progress.
 */
export function usePullToRefresh(
  onRefresh: () => Promise<unknown> | void,
  threshold = 80,
): { offset: number; refreshing: boolean } {
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const onStart = (e: TouchEvent): void => {
      if (window.scrollY > 0) return;
      startY.current = e.touches[0]?.clientY ?? null;
    };
    const onMove = (e: TouchEvent): void => {
      if (startY.current === null) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
      if (dy <= 0) {
        setOffset(0);
        return;
      }
      const damped = Math.min(threshold * 1.5, dy * 0.6);
      setOffset(damped);
    };
    const onEnd = async (): Promise<void> => {
      if (startY.current === null) return;
      const triggered = offset >= threshold;
      startY.current = null;
      setOffset(0);
      if (triggered && !refreshing) {
        setRefreshing(true);
        try { await onRefresh(); }
        finally { setRefreshing(false); }
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [onRefresh, threshold, offset, refreshing]);

  return { offset, refreshing };
}
