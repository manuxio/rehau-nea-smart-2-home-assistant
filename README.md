# REHAU NEA SMART 2.0 - Home Assistant Add-on

Home Assistant add-on for REHAU NEA SMART 2.0 heating system integration via MQTT.

## Installation

### Step 1: Add Repository to Home Assistant

1. Navigate to **Settings** → **Add-ons** → **Add-on Store**
2. Click the **⋮** (three dots) menu in the top right
3. Select **Repositories**
4. Add this URL:
   ```
   https://github.com/manuxio/rehau-nea-smart-2-home-assistant
   ```
5. Click **Add**

### Step 2: Install the Add-on

1. Refresh the Add-on Store page
2. Find **REHAU NEA SMART 2.0 MQTT Bridge** in the list
3. Click on it and press **Install**
4. Wait for the installation to complete

### Step 3: Configure the Add-on

1. Go to the **Configuration** tab
2. Fill in your REHAU credentials:
   - **rehau_email**: Your REHAU NEA SMART account email
   - **rehau_password**: Your REHAU NEA SMART account password
3. Configure MQTT settings:
   - **mqtt_host**: Usually `core-mosquitto` if using the Mosquitto add-on
   - **mqtt_port**: Usually `1883`
   - **mqtt_user**: Your MQTT username (if authentication is enabled)
   - **mqtt_password**: Your MQTT password (if authentication is enabled)
4. (Optional) Adjust intervals:
   - **zone_reload_interval**: How often to reload zone data (default: 300 seconds)
   - **token_refresh_interval**: How often to refresh authentication (default: 21600 seconds)
   - **referentials_reload_interval**: How often to reload referentials (default: 86400 seconds)

### Step 4: Start the Add-on

1. Go to the **Info** tab
2. Click **Start**
3. Enable **Start on boot** if you want it to start automatically
4. Check the **Log** tab to verify it's running correctly

## Features

### Climate Control
- **Climate entities** for each heating zone with full thermostat control
- **Separate temperature and humidity sensors** per zone
- **Outside temperature sensor**
- **Installation-wide mode control** (heat/cool switching)
- **Optimistic mode** for instant UI feedback

### LIVE Data Monitoring (v2.1.0+)
- **Mixed Circuit sensors** - Setpoint, supply, return temperatures, valve opening, pump state
- **Digital I/O sensors** - DI0-DI4, DO0-DO5 for advanced monitoring
- **Periodic polling** - Auto-refresh every 5 minutes (configurable)
- **Diagnostic entities** - Hidden by default, visible in device diagnostics

### System Features
- **Real-time MQTT updates** from REHAU system
- **Configurable update intervals** for zones, tokens, and referentials
- **Automatic token refresh** with fallback to fresh login
- **Enhanced debug logging** with sensitive data redaction
- **TypeScript implementation** with strict type safety

## What You'll Get in Home Assistant

After starting the add-on, you'll see:

- **Climate entities**: One per zone (e.g., `climate.rehau_<installation>_zone_<number>`)
  - Control temperature setpoint
  - Switch between comfort/away presets
  - Turn zones on/off
- **Temperature sensors**: One per zone (e.g., `sensor.rehau_<room>_temperature`)
- **Humidity sensors**: One per zone (e.g., `sensor.rehau_<room>_humidity`)
- **Outside temperature sensor**: `sensor.rehau_<installation>_outside_temp`
- **Mode control**: `climate.rehau_<installation>_mode_control` for heat/cool switching
- **LIVE sensors** (diagnostic): Mixed circuits, pumps, digital I/O - visible in device diagnostics page

## Debugging

### Enabling Debug Mode

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
   ````
   ```text
   [paste your log excerpt here]
   ```
   ````

### Common Debug Scenarios

**Connection Issues:**
```yaml
log_level: "debug"
```
Look for:
- MQTT connection messages
- Authentication errors
- Network timeouts

**Missing Sensors:**
```yaml
log_level: "debug"
```
Look for:
- LIVE_EMU and LIVE_DIDO responses
- Sensor discovery messages
- MQTT publish confirmations

**Temperature/Control Issues:**
```yaml
log_level: "debug"
```
Look for:
- Zone update messages
- Command messages to REHAU
- Temperature conversion logs

## Troubleshooting

### Add-on won't start
- Check the Log tab for error messages
- Verify your REHAU credentials are correct
- Ensure MQTT broker is running and accessible

### No entities appearing
- Check that MQTT integration is set up in Home Assistant
- Verify the add-on is connected to MQTT (check logs)
- Wait a few minutes for discovery to complete

### Entities show as unavailable
- Check MQTT broker is running
- Verify MQTT credentials in add-on configuration
- Restart the add-on

## Documentation

For detailed information:
- **[Complete Add-on Documentation](rehau-nea-smart-mqtt-bridge/README.md)** - Full configuration, debugging guide, and advanced features
- **[CHANGELOG](rehau-nea-smart-mqtt-bridge/CHANGELOG.md)** - Version history and release notes

## Support

For issues and feature requests, please visit:
https://github.com/manuxio/rehau-nea-smart-2-home-assistant/issues

**Before opening an issue:**
1. Enable debug mode (`log_level: "debug"`) and review logs
2. Check existing issues for similar problems
3. Include add-on version, Home Assistant version, and relevant log excerpts
4. See the debugging guide in the add-on README
