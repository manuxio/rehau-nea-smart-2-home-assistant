# Test Suite

This folder contains tests for the REHAU NEA SMART 2.0 MQTT Bridge project.

## Available Tests

### Configuration Validation Tests

**File**: `test-config-validation.ts`

Runs a comprehensive test suite for runtime configuration validation.

**Run**:
```bash
npm run test:config-validation
```

**What it tests**:
- ✅ Valid configuration
- ❌ Missing email or invalid format
- ⚠️ Password too short (warning)
- ❌ MQTT/API ports out of range
- ❌ MQTT username without password
- ❌ Invalid hostname
- ✅ Valid IPv4 address
- ❌ Intervals out of range
- ⚠️ Invalid LOG_LEVEL (warning)
- ⚠️ Invalid USE_GROUP_IN_NAMES (warning)

**Output**: Shows a summary with all passed/failed tests and details of errors and warnings generated.

### Memory Leaks and Cleanup Tests

**File**: Documentation and manual tests

**Run manual tests**:

1. **Monitor memory usage during prolonged execution**:
   ```bash
   # Start the application
   npm start
   
   # In another terminal, monitor memory usage every 10 seconds
   watch -n 10 'ps aux | grep node | grep -v grep | awk "{print \$6/1024 \" MB\"}"'
   ```

2. **Verify cleanup on shutdown**:
   ```bash
   # Start the application
   npm start
   
   # Wait for complete initialization
   # Send SIGTERM or SIGINT (Ctrl+C)
   # Verify in logs that all cleanup operations were executed
   ```

3. **Verify cleanup on critical errors**:
   ```bash
   # Start the application
   npm start
   
   # Simulate critical error (e.g. kill -9)
   # Verify that cleanup is called even for unhandled errors
   ```

**What to verify**:
- ✅ Memory usage does not constantly increase during prolonged execution
- ✅ All timers are properly cleaned up on shutdown
- ✅ All subscriptions are removed on shutdown
- ✅ All MQTT connections are properly closed
- ✅ Cleanup is called even on critical errors (uncaughtException, unhandledRejection)
- ✅ Cleanup is idempotent (multiple calls are safe)
- ✅ No memory leaks after multiple shutdowns and restarts

**Example script for memory monitoring**:
```javascript
// monitor-memory.js
const { spawn } = require('child_process');

const app = spawn('npm', ['start'], { stdio: 'inherit' });

setInterval(() => {
  const memUsage = process.memoryUsage();
  console.log(`Memory: RSS=${(memUsage.rss/1024/1024).toFixed(2)}MB, Heap=${(memUsage.heapUsed/1024/1024).toFixed(2)}MB`);
}, 10000);

app.on('exit', () => {
  console.log('Application exited');
  process.exit(0);
});
```

## Notes

Tests use `ts-node` to execute TypeScript files directly without compilation.

For more details on manual tests, see `../docs/TEST_CONFIG_VALIDATION.md`.
