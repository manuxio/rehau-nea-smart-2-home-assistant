# Testing Checklist - Use for EVERY Task

> **⚠️ CRITICAL**: A task is NOT complete until ALL items below are checked!

## Before Marking Task as [x] Complete

### 1. Code Quality
- [ ] Code compiles without errors
- [ ] No TypeScript errors
- [ ] No linting warnings
- [ ] Code follows existing patterns
- [ ] Comments added for complex logic

### 2. Build & Start
- [ ] `npm run build` succeeds
- [ ] `npm start` starts without errors
- [ ] No errors in startup logs
- [ ] All services initialize correctly

### 3. Feature Testing
- [ ] New feature works as expected
- [ ] Feature tested with real REHAU system
- [ ] Feature tested with real MQTT broker
- [ ] Edge cases tested (errors, timeouts, etc.)
- [ ] Logs show correct behavior

### 4. Regression Testing
- [ ] MQTT bridge still works
- [ ] Home Assistant discovery still works
- [ ] Zone updates still work
- [ ] Temperature commands still work
- [ ] Authentication still works
- [ ] All existing features functional

### 5. Performance
- [ ] No memory leaks observed (check after 5 minutes)
- [ ] Response times acceptable
- [ ] No excessive CPU usage
- [ ] Logs not flooded with messages

### 6. Logging
- [ ] Appropriate log level used
- [ ] Logs are informative
- [ ] No sensitive data in logs (unless normal mode)
- [ ] Emojis and colors display correctly
- [ ] Direction indicators correct (⬆️⬇️🔄)

### 7. Git
- [ ] Changes committed with descriptive message
- [ ] Commit follows convention (feat/fix/docs/etc)
- [ ] Pushed to feature branch
- [ ] Roadmap updated with [x]

## Quick Test Commands

```bash
# Build
npm run build

# Start and watch logs
npm start

# In another terminal, test MQTT
mosquitto_pub -h localhost -t "rehau/test" -m "test"

# Check memory usage
ps aux | grep node

# Check logs
tail -f logs/combined.log
```

## Real REHAU System Tests

### For Logging Tasks
- [ ] Start bridge and check log colors
- [ ] Send temperature command, verify direction (⬆️)
- [ ] Receive MQTT message, verify direction (⬇️)
- [ ] Check emojis display correctly
- [ ] Export shareable logs, verify obfuscation

### For API Tasks
- [ ] Test login endpoint
- [ ] Test zone endpoints
- [ ] Test WebSocket connection
- [ ] Verify Swagger docs accessible
- [ ] Test with real zone data

### For Web UI Tasks
- [ ] Open in mobile browser
- [ ] Test on iOS Safari
- [ ] Test on Android Chrome
- [ ] Test all buttons and sliders
- [ ] Verify real-time updates work

### For Playwright Tasks
- [ ] Trigger authentication
- [ ] Verify browser closes after idle
- [ ] Check memory usage before/after
- [ ] Verify tokens cached correctly

## When Something Fails

1. **Don't mark [x]** - Task is not complete
2. **Document the issue** in roadmap
3. **Fix the issue** before continuing
4. **Re-test everything** after fix
5. **Only then mark [x]**

## Example: Completed Task

```markdown
- [x] Create enhanced logger with colors
  ✅ Tested: Colors display in terminal
  ✅ Tested: Emojis show correctly
  ✅ Tested: MQTT bridge still works
  ✅ Tested: Zone updates work
  ✅ Committed: feat(logging): add colorful logger
  ✅ Memory: Stable at 85MB after 10 minutes
```

## Example: Failed Task

```markdown
- [ ] Create enhanced logger with colors
  ❌ Issue: Colors don't work on Windows
  ❌ Issue: Memory leak detected (120MB → 250MB)
  → Need to fix before marking complete
  → Added to "What Didn't Work" section
```

---

**Remember**: Quality over speed. Better to have 5 working features than 10 broken ones!
