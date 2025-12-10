# Troubleshooting Guide

Comprehensive troubleshooting guide for the REHAU NEA SMART 2.0 MQTT Bridge.

## Table of Contents

- [Debug Mode](#debug-mode)
- [Common Issues](#common-issues)
- [Debug Scenarios](#debug-scenarios)
- [Log Analysis](#log-analysis)
- [MQTT Debugging](#mqtt-debugging)
- [Entity Issues](#entity-issues)

---

## Debug Mode

Debug mode provides detailed logging for troubleshooting issues.

### Enabling Debug Mode

**Home Assistant Add-on:**
1. Go to the add-on **Configuration** tab
2. Set `log_level: "debug"`
3. Restart the add-on
4. Check the **Log** tab for detailed output

**Docker/Standalone:**
```bash
export LOG_LEVEL=debug
# Or in docker-compose.yml:
environment:
  - LOG_LEVEL=debug
```

### Debug Mode Warning

When debug mode is enabled, the bridge logs **detailed information** including:
- Full MQTT messages
- HTTP requests and responses
- Authentication tokens and session data
- Installation details

**Sensitive data is automatically redacted** in debug logs:
- ✅ Passwords → `[REDACTED]`
- ✅ Tokens → First 2 and last 2 characters shown (e.g., `ey...PM`)
- ✅ Email addresses → Partially masked (e.g., `ma...et`)
- ✅ Installation addresses → `[REDACTED]`
- ✅ GPS coordinates → `[REDACTED]`

However, **other personal information may still be visible**:
- Installation names
- Zone names
- Temperature values
- System configuration

### Sharing Logs Safely

When sharing logs on GitHub issues or public forums:

1. **Always review logs before sharing** - even with redaction enabled
2. **Check for personal information**:
   - Installation names (e.g., "John's House")
   - Zone names (e.g., "Master Bedroom")
   - Any other identifying information
3. **Use debug mode only when needed** - switch back to `info` level after troubleshooting
4. **Copy only relevant sections** - don't share entire log files
5. **Use code blocks** when pasting logs in GitHub issues:
   ```text
   [paste your log excerpt here]
   ```

---

## Common Issues

### Add-on Won't Start

**Symptoms:**
- Add-on fails to start
- Error messages in Log tab
- Exit code 1

**Solutions:**
1. Check the Log tab for error messages
2. Verify your REHAU credentials are correct
3. Ensure MQTT broker is running and accessible
4. Check configuration validation errors (see [Configuration Reference](../DOCS.md))
5. Verify all required configuration options are set

**Common Errors:**
- `Configuration validation failed` → Check required fields
- `MQTT connection failed` → Verify MQTT broker is accessible
- `REHAU authentication failed` → Check email/password

### No Entities Appearing

**Symptoms:**
- Bridge starts successfully
- No REHAU entities in Home Assistant
- MQTT integration shows no devices

**Solutions:**
1. Check that MQTT integration is set up in Home Assistant
2. Verify the bridge is connected to MQTT (check logs)
3. Wait a few minutes for discovery to complete
4. Restart MQTT integration if needed
5. Enable debug mode and check for discovery messages
6. Verify MQTT Discovery is enabled in Home Assistant

**Debug Steps:**
```yaml
log_level: "debug"
```
Look for:
- MQTT connection successful messages
- Zone discovery messages
- MQTT publish confirmations

### Entities Show as Unavailable

**Symptoms:**
- Entities appear but show as "unavailable"
- No temperature readings
- Controls don't respond

**Solutions:**
1. Check MQTT broker is running
2. Verify MQTT credentials in bridge configuration
3. Restart the bridge
4. Check MQTT connection in logs
5. Verify network connectivity between bridge and broker
6. Check MQTT broker logs for connection issues

**Debug Steps:**
```yaml
log_level: "debug"
```
Look for:
- MQTT connection errors
- Reconnection attempts
- Publish failures

### Wrong Temperature Readings

**Symptoms:**
- Temperatures don't match REHAU app
- Wrong zone shows wrong temperature
- Temperature readings are inconsistent

**Solutions:**
1. **Check zone mapping** in bridge logs (set `log_level: debug`)
2. **Verify zone IDs** match between REHAU app and Home Assistant
3. **Restart bridge** to refresh all data
4. **Check for zone ID conflicts** (should not happen in v2.3.3+)
5. **Verify installation data** is loading correctly

**Debug Steps:**
```yaml
log_level: "debug"
```
Look for:
- Zone mapping messages
- Zone ID assignments
- Temperature update messages

### Old Entities Still Visible (After v2.3.3 Upgrade)

**Symptoms:**
- Old entity IDs still present after upgrade
- Duplicate entities
- Entities with old naming scheme

**Solutions:**
1. **Delete old MQTT devices** manually from Home Assistant:
   - Go to **Settings** → **Devices & Services** → **MQTT**
   - Find old REHAU devices
   - Delete each device
2. **Clear MQTT retained messages**:
   ```bash
   mosquitto_pub -h localhost -t "homeassistant/climate/rehau_+/config" -n -r
   mosquitto_pub -h localhost -t "homeassistant/sensor/rehau_+/config" -n -r
   mosquitto_pub -h localhost -t "homeassistant/light/rehau_+/config" -n -r
   mosquitto_pub -h localhost -t "homeassistant/lock/rehau_+/config" -n -r
   ```
3. **Restart Home Assistant**
4. **Wait for new entities** to appear with new naming scheme

### MQTT Connection Issues

**Symptoms:**
- Bridge can't connect to MQTT broker
- Connection errors in logs
- Intermittent connectivity

**Solutions:**
1. Verify `mqtt_host` and `mqtt_port` are correct
2. Check if MQTT broker requires authentication
3. If using authentication, ensure both `mqtt_user` and `mqtt_password` are set
4. Verify network connectivity:
   - Ping MQTT broker from bridge container
   - Check firewall rules
   - Verify Docker network configuration
5. Check MQTT broker logs for connection attempts
6. Verify broker is accepting connections on the specified port

**Network Debugging:**
```bash
# From bridge container
ping mqtt-broker
telnet mqtt-broker 1883

# Check Docker network
docker network inspect rehau-network
```

### Authentication Errors

**Symptoms:**
- REHAU authentication fails
- Token refresh errors
- Login failures

**Solutions:**
1. Verify REHAU email and password are correct
2. Check REHAU account is active
3. Check for account lockouts (too many failed attempts)
4. Verify network connectivity to REHAU API
5. Check token refresh interval is reasonable
6. Enable debug mode to see detailed auth messages

**Debug Steps:**
```yaml
log_level: "debug"
```
Look for:
- Authentication request/response
- Token refresh messages
- Error codes from REHAU API

---

## Debug Scenarios

### Connection Issues

**Configuration:**
```yaml
log_level: "debug"
```

**What to Look For:**
- MQTT connection messages
- Authentication errors
- Network timeouts
- Connection retry attempts

**Example Log Messages:**
```
[INFO] Connecting to MQTT broker at mqtt-broker:1883
[DEBUG] MQTT connection attempt 1/3
[ERROR] MQTT connection failed: Connection refused
```

### Missing Sensors

**Configuration:**
```yaml
log_level: "debug"
```

**What to Look For:**
- LIVE_EMU and LIVE_DIDO API responses
- Sensor discovery messages
- MQTT publish confirmations
- Sensor data parsing errors

**Example Log Messages:**
```
[DEBUG] Fetching LIVE_EMU data for zone 6595d1d5cceecee9ce9772e1
[DEBUG] LIVE_EMU response received: {...}
[DEBUG] Publishing sensor data to MQTT
[INFO] Sensor discovery published: rehau_6595d1d5cceecee9ce9772e1_temperature
```

### Temperature/Control Issues

**Configuration:**
```yaml
log_level: "debug"
```

**What to Look For:**
- Zone update messages
- Command messages to REHAU
- Temperature conversion logs
- Setpoint changes
- Mode/preset changes

**Example Log Messages:**
```
[DEBUG] Zone update received: zone_6595d1d5cceecee9ce9772e1
[DEBUG] Current temperature: 20.5°C
[DEBUG] Target temperature: 22.0°C
[DEBUG] Sending setpoint command: 22.0°C
[DEBUG] Command response: success
```

---

## Log Analysis

### Understanding Log Levels

- **`error`**: Only critical errors that prevent operation
- **`warn`**: Warnings about non-critical issues
- **`info`**: General information about bridge operation (recommended)
- **`debug`**: Detailed debugging information (use for troubleshooting)

### Key Log Messages

**Successful Startup:**
```
[INFO] REHAU NEA SMART MQTT Bridge starting...
[INFO] Configuration validated successfully
[INFO] Connecting to MQTT broker...
[INFO] MQTT connected successfully
[INFO] Authenticating with REHAU API...
[INFO] Authentication successful
[INFO] Loading installations...
[INFO] Zones discovered: 5
[INFO] Publishing entities to MQTT...
[INFO] Bridge ready
```

**Common Error Patterns:**
- `Configuration validation failed` → Check configuration
- `MQTT connection failed` → Check broker connectivity
- `Authentication failed` → Check REHAU credentials
- `No zones found` → Check installation access
- `Publish failed` → Check MQTT connection

---

## MQTT Debugging

### Checking MQTT Topics

Use an MQTT client to subscribe to topics:

```bash
# Subscribe to all REHAU topics
mosquitto_sub -h localhost -t "homeassistant/climate/rehau_+/#" -v

# Subscribe to specific zone
mosquitto_sub -h localhost -t "homeassistant/climate/rehau_6595d1d5cceecee9ce9772e1/#" -v

# Check discovery messages
mosquitto_sub -h localhost -t "homeassistant/+/rehau_+/config" -v
```

### Common MQTT Issues

**Retained Messages:**
- Old retained messages can cause stale data
- Clear retained messages when upgrading
- Use `-r` flag with `mosquitto_pub` to clear

**Topic Permissions:**
- Verify MQTT user has publish/subscribe permissions
- Check ACL rules if using authentication
- Verify topic patterns match

**QoS Levels:**
- Bridge uses QoS 0 for most messages
- Discovery messages use QoS 1
- Commands use QoS 1 for reliability

---

## Entity Issues

### Entity Not Updating

**Symptoms:**
- Entity shows stale data
- Temperature doesn't change
- Controls don't respond

**Solutions:**
1. Check `zone_reload_interval` is not too high
2. Verify bridge is running and connected
3. Check MQTT connection status
4. Verify zone is active in REHAU system
5. Check for errors in bridge logs

### Entity ID Conflicts

**Symptoms:**
- Duplicate entity IDs
- Entities overwriting each other
- Wrong data in entities

**Solutions:**
1. This should not happen in v2.3.3+ (uses unique zone IDs)
2. If upgrading from older version, follow migration guide
3. Delete old entities and restart bridge
4. Verify zone IDs are unique in logs

### Display Name Issues

**Symptoms:**
- Display names not as expected
- Group names missing or included incorrectly

**Solutions:**
1. Check `use_group_in_names` configuration
2. Restart bridge after changing configuration
3. Delete and rediscover entities
4. Verify zone/group names in REHAU system

---

## Getting Help

If you're still experiencing issues:

1. **Enable debug mode** and collect logs
2. **Review logs** for error messages
3. **Check GitHub Issues** for similar problems
4. **Create a new issue** with:
   - Bridge version
   - Home Assistant version
   - Configuration (redact sensitive data)
   - Relevant log excerpts
   - Steps to reproduce

**Before Creating an Issue:**
- ✅ Checked this troubleshooting guide
- ✅ Enabled debug mode and reviewed logs
- ✅ Verified configuration is correct
- ✅ Checked existing GitHub issues
- ✅ Redacted sensitive information from logs

---

## Related Documentation

- [Configuration Reference](../DOCS.md) - Configuration options
- [Installation Guide](INSTALLATION.md) - Installation troubleshooting
- [Entity Reference](ENTITY_REFERENCE.md) - Entity naming issues
- [Configuration Validation Testing](TEST_CONFIG_VALIDATION.md) - Testing configuration

