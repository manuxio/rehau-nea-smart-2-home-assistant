/**
 * RateLimiter - Prevents command execution if minimum interval hasn't elapsed
 * 
 * Tracks the last execution time for each key (typically installId) and
 * prevents execution if the minimum interval hasn't passed since the last execution.
 */
class RateLimiter {
  private lastExecution: Map<string, number> = new Map();
  private minInterval: number;

  /**
   * Create a new RateLimiter instance
   * @param minIntervalMs - Minimum interval in milliseconds between executions for the same key
   */
  constructor(minIntervalMs: number) {
    if (minIntervalMs < 0) {
      throw new Error('Rate limiter interval must be non-negative');
    }
    this.minInterval = minIntervalMs;
  }

  /**
   * Check if a command can be executed for the given key
   * @param key - The key to check (typically installId)
   * @returns true if execution is allowed, false if rate limit is active
   */
  canExecute(key: string): boolean {
    const lastTime = this.lastExecution.get(key);
    if (!lastTime) {
      // First execution for this key - always allowed
      return true;
    }

    const elapsed = Date.now() - lastTime;
    return elapsed >= this.minInterval;
  }

  /**
   * Record that a command was executed for the given key
   * @param key - The key to record execution for (typically installId)
   */
  recordExecution(key: string): void {
    this.lastExecution.set(key, Date.now());
  }

  /**
   * Get the time remaining until the next execution is allowed
   * @param key - The key to check (typically installId)
   * @returns Milliseconds until next execution is allowed (0 if allowed now)
   */
  getTimeUntilNextExecution(key: string): number {
    const lastTime = this.lastExecution.get(key);
    if (!lastTime) {
      // No previous execution - allowed now
      return 0;
    }

    const elapsed = Date.now() - lastTime;
    const remaining = this.minInterval - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Clear the execution record for a specific key
   * Useful for testing or resetting state
   * @param key - The key to clear (optional, clears all if not provided)
   */
  clear(key?: string): void {
    if (key) {
      this.lastExecution.delete(key);
    } else {
      this.lastExecution.clear();
    }
  }

  /**
   * Get the minimum interval configured for this rate limiter
   * @returns Minimum interval in milliseconds
   */
  getMinInterval(): number {
    return this.minInterval;
  }
}

export default RateLimiter;
