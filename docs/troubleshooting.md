# Debugging & Troubleshooting

This guide helps you troubleshoot common issues with the REHAU NEA SMART MQTT Bridge.

## Enabling Debug Mode

To enable detailed logging for troubleshooting:

1. Go to the add-on **Configuration** tab
2. Set `log_level: "debug"`
3. Restart the add-on
4. Check the **Log** tab for detailed output

**⚠️ IMPORTANT - Debug Mode Warning:**

When debug mode is enabled, the add-on will log **detailed information** including:
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

## Sharing Logs Safely

When sharing logs on GitHub issues or public forums:

1. **Always review logs before sharing** - even with redaction enabled
2. **Check for personal information**:
   - Installation names (e.g., "John's House")
   - Zone names (e.g., "Master Bedroom")
   - Any other identifying information
3. **Use debug mode only when needed** - switch back to `info` level after troubleshooting
4. **Copy only relevant sections** - don't share entire log files
5. **Use code blocks** when pasting logs in GitHub issues:
   ````
   ```text
   [paste your log excerpt here]
   ```
   ````

## Common Issues

### Add-on won't start

**Symptoms:**
- Add-on fails to start
- Error messages in the Log tab

**Solutions:**
- Check the Log tab for error messages
- Verify your REHAU credentials are correct
- Ensure MQTT broker is running and accessible
- Check that all required configuration fields are set

### No entities appearing

**Symptoms:**
- Bridge is running but no REHAU entities appear in Home Assistant
- MQTT integration is configured but shows no devices

**Solutions:**
- Check that MQTT integration is set up in Home Assistant
- Verify the add-on is connected to MQTT (check logs)
- Wait a few minutes for discovery to complete
- Restart MQTT integration if needed
- Check that MQTT Discovery is enabled in Home Assistant MQTT settings

### Entities show as unavailable

**Symptoms:**
- Entities appear in Home Assistant but show as "unavailable"
- Entities were working but suddenly became unavailable

**Solutions:**
- Check MQTT broker is running
- Verify MQTT credentials in add-on configuration
- Restart the add-on
- Check MQTT connection in logs
- Verify network connectivity between bridge and MQTT broker

### Wrong Temperature Readings

**Symptoms:**
- Temperature values don't match REHAU app
- Multiple zones showing the same temperature
- Temperature readings seem incorrect

**Solutions:**
1. **Check zone mapping** in add-on logs (set `log_level: debug`)
2. **Verify zone IDs** match between REHAU app and Home Assistant
3. **Restart add-on** to refresh all data
4. If upgrading from v2.3.2 or earlier, ensure you've completed the migration (see [Migration Guide](./migration.md))

### Old Entities Still Visible (After v2.3.3 Upgrade)

**Symptoms:**
- Old entity IDs still appear after upgrading to v2.3.3
- Both old and new entities are visible
- Entities show duplicate data

**Solutions:**
1. **Delete old MQTT devices** manually from Home Assistant
2. **Clear MQTT retained messages** (see Migration Guide Step 3 Option B)
3. **Restart Home Assistant**
4. Ensure you've completed all migration steps from the [Migration Guide](./migration.md)

## Common Debug Scenarios

### Connection Issues

**Configuration:**
```yaml
log_level: "debug"
```

**What to look for:**
- MQTT connection messages
- Authentication errors
- Network timeouts
- Connection refused errors

**Common fixes:**
- Verify MQTT broker hostname/IP is correct
- Check MQTT broker port (usually 1883)
- Verify MQTT credentials if authentication is enabled
- Check firewall rules if using remote MQTT broker

### Missing Sensors

**Configuration:**
```yaml
log_level: "debug"
```

**What to look for:**
- LIVE_EMU and LIVE_DIDO responses
- Sensor discovery messages
- MQTT publish confirmations
- Error messages about sensor data

**Common fixes:**
- Check that your REHAU system supports LIVE data (v2.1.0+ feature)
- Verify zone reload interval is not too high
- Check for API rate limiting errors
- Ensure REHAU credentials have proper permissions

### Temperature/Control Issues

**Configuration:**
```yaml
log_level: "debug"
```

**What to look for:**
- Zone update messages
- Command messages to REHAU
- Temperature conversion logs
- Error responses from REHAU API

**Common fixes:**
- Verify zone IDs are correct
- Check that commands are being sent to the right zone
- Verify REHAU API is responding correctly
- Check for zone lock status (locked zones may not accept commands)

## Getting Help

If you're still experiencing issues after trying the troubleshooting steps above:

1. **Enable debug mode** and collect relevant log excerpts
2. **Check existing issues** on GitHub for similar problems
3. **Create a new issue** with:
   - Add-on version
   - Home Assistant version
   - Relevant log excerpts (with sensitive data redacted)
   - Description of the problem
   - Steps to reproduce

## Related Documentation

- [Configuration Guide](./configuration.md) - Configuration options
- [Migration Guide](./migration.md) - Migration from older versions
- [Installation Guide](./installation.md) - Installation troubleshooting
