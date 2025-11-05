# REHAU NEA SMART MQTT Bridge

TypeScript-based MQTT bridge for REHAU NEA SMART 2.0 heating systems.

> **⚠️ IMPORTANT:** Version 2.0+ introduces breaking changes. Version 2.3.0 fixes critical bugs. See [BREAKING CHANGES](#️-breaking-changes) below and [CHANGELOG](CHANGELOG.md) for full details.

## ⚠️ BREAKING CHANGES

### Version 2.3.0 - Critical Bug Fix (November 2025)

**🔴 MQTT Topics Changed - Affects Multi-Group Installations**

If you have multiple groups (e.g., Upstairs/Downstairs), MQTT topics have changed to fix a critical bug where zones were overwriting each other.

**What Changed:**
- MQTT topics now use unique channel IDs instead of zone numbers
- **Before**: `homeassistant/climate/rehau_6ba0..._zone_0/`
- **After**: `homeassistant/climate/rehau_6595d1d5cceecee9ce9772e1/`

**Migration Steps:**
1. **Delete old MQTT integration** in Home Assistant (Settings → Devices & Services → MQTT)
2. **Restart the add-on** - New topics will be auto-discovered
3. **Update automations/scripts** that reference REHAU entities (entity IDs remain the same, only MQTT topics changed)

**Why This Change:**
- Fixed bug where zones with same number in different groups overwrote each other
- Example: "Upstairs Zone 0" and "Downstairs Zone 0" now both visible (previously only one appeared)
- All zones now have globally unique MQTT topics

---

### Version 2.0+ - Entity ID Structure

**Version 2.0+ introduces new entity IDs for better consistency and future compatibility.**

### Why the Change?

Previous versions used inconsistent entity ID patterns that could cause conflicts when multiple zones had the same name in different groups. The new structure ensures:
- **Unique entity IDs** across all zones
- **Hierarchical naming** that includes installation, group, and zone
- **Future-proof structure** for additional features
- **Consistent naming** across all entity types

### Migration Required

After upgrading to v2.0+, your entity IDs will change. You will need to:

1. **Update automations** that reference old entity IDs
2. **Update dashboards** with new entity names
3. **Update scripts** that control REHAU entities
4. **Reconfigure integrations** that use REHAU entities

### Entity ID Changes

| Old Pattern | New Pattern |
|-------------|-------------|
| `climate.rehau_myinstall_myinstall_zone` | `climate.rehau_myinstall_groupname_zonename` |
| `sensor.rehau_myinstall_zone_temperature` | `sensor.rehau_groupname_zonename_temperature` |
| `sensor.rehau_myinstall_zone_humidity` | `sensor.rehau_groupname_zonename_humidity` |

**Note:** Group names are now always included in entity IDs for consistency, even if you have only one group.

### Display Names

The `USE_GROUP_IN_NAMES` environment variable controls display names (friendly names), not entity IDs:
- **When `true`**: Display names include group (e.g., "Atilio Salone")
- **When `false`**: Display names show only zone (e.g., "Salone")
- **Entity IDs**: Always include group name regardless of this setting

## About

This add-on connects your REHAU NEA SMART 2.0 heating system to Home Assistant via MQTT, creating climate entities for each zone with full control capabilities.

## MQTT Topic Structure

Understanding how topics and entity IDs are generated:

### Example Installation
- **Installation**: MyHouse (`6ba02d11303856504e329dbc27165454`)
- **Groups**: Upstairs, Downstairs
- **Zones**: 9 zones across 2 groups

### Topic & Entity ID Table

| Group | Zone | Zone# | Channel ID | HA Entity ID | MQTT Discovery Topic | MQTT State Topics |
|-------|------|-------|------------|--------------|---------------------|-------------------|
| Upstairs | Landing | 0 | `6595d1d5...` | `climate.rehau_myhouse_upstairs_landing` | `homeassistant/climate/rehau_6595d1d5.../config` | `.../rehau_6595d1d5.../mode`<br>`.../rehau_6595d1d5.../temperature_command` |
| Upstairs | Kids Bedroom | 2 | `6595d1d7...` | `climate.rehau_myhouse_upstairs_kids_bedroom` | `homeassistant/climate/rehau_6595d1d7.../config` | `.../rehau_6595d1d7.../mode`<br>`.../rehau_6595d1d7.../temperature_command` |
| Downstairs | Kitchen | 0 | `6595d1e1...` | `climate.rehau_myhouse_downstairs_kitchen` | `homeassistant/climate/rehau_6595d1e1.../config` | `.../rehau_6595d1e1.../mode`<br>`.../rehau_6595d1e1.../temperature_command` |
| Downstairs | Bedroom 5 | 0 | `6618fa32...` | `climate.rehau_myhouse_downstairs_bedroom_5` | `homeassistant/climate/rehau_6618fa32.../config` | `.../rehau_6618fa32.../mode`<br>`.../rehau_6618fa32.../temperature_command` |

### Key Points

✅ **Entity IDs** are human-readable and include group + zone names  
✅ **MQTT Topics** use unique channel IDs to prevent collisions  
✅ **Zone numbers** can repeat across groups (both have Zone 0)  
✅ **Channel IDs** are globally unique (no collisions possible)

### Full Topic Examples

**Climate Entity:**
```
Discovery: homeassistant/climate/rehau_6595d1d5cceecee9ce9772e1/config
State:     homeassistant/climate/rehau_6595d1d5cceecee9ce9772e1/mode
           homeassistant/climate/rehau_6595d1d5cceecee9ce9772e1/current_temperature
           homeassistant/climate/rehau_6595d1d5cceecee9ce9772e1/target_temperature
Commands:  homeassistant/climate/rehau_6595d1d5cceecee9ce9772e1/mode_command
           homeassistant/climate/rehau_6595d1d5cceecee9ce9772e1/preset_command
           homeassistant/climate/rehau_6595d1d5cceecee9ce9772e1/temperature_command
```

**Sensor Entities:**
```
Temperature: homeassistant/sensor/rehau_6595d1d5cceecee9ce9772e1_temperature/config
Humidity:    homeassistant/sensor/rehau_6595d1d5cceecee9ce9772e1_humidity/config
```

**Lock & Light:**
```
Lock:       homeassistant/lock/rehau_6595d1d5cceecee9ce9772e1_lock/config
Ring Light: homeassistant/light/rehau_6595d1d5cceecee9ce9772e1_ring_light/config
```

## Prerequisites

Before installing this add-on, you must have:

1. **REHAU NEA SMART 2.0 system** configured via the official REHAU app
   - Create your account and complete the initial setup
   - Configure your installation and zones in the REHAU mobile app
   - Ensure your system is working properly in the app before proceeding

2. **MQTT Broker running in Home Assistant**
   - Install the **Mosquitto broker** add-on from the official add-on store
   - Go to **Settings** → **Add-ons** → **Add-on Store**
   - Search for "Mosquitto broker" and install it
   - **Important**: In Mosquitto configuration, either:
     - Leave authentication disabled (remove `logins:` section), OR
     - Create a user and provide those credentials in this add-on's configuration
   - Start the Mosquitto broker and enable "Start on boot"
   - Note: You can use any MQTT broker, but Mosquitto is recommended

3. **MQTT Integration configured in Home Assistant**
   - Go to **Settings** → **Devices & Services**
   - Click **Add Integration** and search for "MQTT"
   - Configure it to connect to your MQTT broker (usually `core-mosquitto` on port 1883)

## Features

- **Climate control entities** for each zone
- **Separate temperature and humidity sensors** per zone
- **Outside temperature sensor**
- **Installation-wide mode control**
- **Ring light control** for each thermostat
- **Lock control** to disable manual adjustments
- **Real-time MQTT updates** from REHAU system
- **Configurable update intervals**
- **Optimistic mode** for instant UI feedback
- **Automatic token refresh**

## Entity Types

This add-on creates multiple entity types in Home Assistant for comprehensive control of your REHAU system.

### Complete Entity List

| Entity Type | Entity ID Pattern | Display Name Pattern | Description | Controllable |
|-------------|-------------------|----------------------|-------------|--------------|
| **Climate** | `climate.rehau_<install>_<group>_<zone>` | `<Group> <Zone>` or `<Zone>` | Main climate control with mode, preset, and temperature | ✅ Yes |
| **Temperature Sensor** | `sensor.rehau_<group>_<zone>_temperature` | `<Group> - <Zone> Temperature` or `<Zone> Temperature` | Current zone temperature in °C | ❌ No |
| **Humidity Sensor** | `sensor.rehau_<group>_<zone>_humidity` | `<Group> - <Zone> Humidity` or `<Zone> Humidity` | Current zone humidity in % | ❌ No |
| **Ring Light** | `light.rehau_<group>_<zone>_ring_light` | `<Group> - <Zone> Ring Light` or `<Zone> Ring Light` | Thermostat ring light control | ✅ Yes |
| **Lock Switch** | `switch.rehau_<group>_<zone>_lock` | `<Group> - <Zone> Lock` or `<Zone> Lock` | Lock/unlock manual thermostat control | ✅ Yes |
| **Outside Temperature** | `sensor.rehau_<installid>_outside_temp` | `Outside Temperature` | Installation outside temperature | ❌ No |
| **Mode Control** | `climate.rehau_<installid>_mode_control` | `Mode Control` | Installation-wide heating/cooling mode | ✅ Yes |

### Entity ID Examples

**With `USE_GROUP_IN_NAMES=false` (Default):**
```
climate.rehau_domodreams_firstfloor_livingroom
sensor.rehau_firstfloor_livingroom_temperature
sensor.rehau_firstfloor_livingroom_humidity
light.rehau_firstfloor_livingroom_ring_light
switch.rehau_firstfloor_livingroom_lock
```
**Display Names:** "Living Room", "Living Room Temperature", "Living Room Humidity", etc.

**With `USE_GROUP_IN_NAMES=true`:**
```
climate.rehau_domodreams_firstfloor_livingroom
sensor.rehau_firstfloor_livingroom_temperature
sensor.rehau_firstfloor_livingroom_humidity
light.rehau_firstfloor_livingroom_ring_light
switch.rehau_firstfloor_livingroom_lock
```
**Display Names:** "First Floor Living Room", "First Floor - Living Room Temperature", "First Floor - Living Room Humidity", etc.

### Climate Entity Controls

The climate entity provides:
- **Modes**: `off`, `heat`, `cool` (depending on system configuration)
- **Presets**: `comfort`, `away`
- **Temperature**: Adjustable setpoint (5-30°C)
- **Current Temperature**: Real-time zone temperature
- **Current Humidity**: Real-time zone humidity

### Additional Controls

**Ring Light Switch:**
- Controls the LED ring on the physical thermostat
- Useful for visual indicators or night mode
- Updates in real-time

**Lock Switch:**
- Locks/unlocks manual control on the physical thermostat
- When locked (ON): Users cannot change settings on the device
- When unlocked (OFF): Users can adjust settings normally
- Useful for preventing unauthorized changes

### Naming Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `<install>` | Installation name (sanitized) | `domodreams` |
| `<group>` | Group name (sanitized) | `firstfloor` |
| `<zone>` | Zone name (sanitized) | `livingroom` |
| `<installid>` | Installation unique ID | `78602d11303856504e3225ee27165454` |

**Note:** Sanitized names are lowercase with spaces replaced by underscores.

## Configuration

```yaml
rehau_email: "your@email.com"
rehau_password: "yourpassword"
mqtt_host: "core-mosquitto"
mqtt_port: 1883
mqtt_user: "homeassistant"
mqtt_password: "yourpassword"
log_level: "info"
zone_reload_interval: 300
token_refresh_interval: 21600
referentials_reload_interval: 86400
use_group_in_names: false
```

## Options

### Required

- `rehau_email`: Your REHAU NEA SMART account email
- `rehau_password`: Your REHAU NEA SMART account password
- `mqtt_host`: MQTT broker hostname (usually `core-mosquitto`)
- `mqtt_port`: MQTT broker port (default: 1883)

### Optional

- `mqtt_user`: MQTT username (if authentication is enabled)
- `mqtt_password`: MQTT password (if authentication is enabled)
- `log_level`: Logging level (debug, info, warn, error) - default: info
- `zone_reload_interval`: How often to reload zone data in seconds - default: 300 (5 minutes)
- `token_refresh_interval`: How often to refresh authentication token in seconds - default: 21600 (6 hours)
- `referentials_reload_interval`: How often to reload referentials in seconds - default: 86400 (24 hours)
- `use_group_in_names`: Include group names in entity display names - default: false
  - `false`: Display names show only zone (e.g., "Salone")
  - `true`: Display names include group (e.g., "Atilio Salone")
  - **Note**: Entity IDs always include group names regardless of this setting

## Where to Find Your Entities

After the add-on starts successfully, your REHAU entities will appear in Home Assistant:

### Climate Entities
- Go to **Settings** → **Devices & Services** → **MQTT**
- You'll see a device named **REHAU [Your Installation Name]**
- Click on it to see all climate controls and sensors

### Using the Entities
- **Climate controls** will appear in your climate entity list
  - Example: `climate.rehau_myinstallation_zone_2`
- **Temperature sensors** will be available for automations and dashboards
  - Example: `sensor.rehau_kitchen_temperature`
- **Humidity sensors** will show current humidity levels
  - Example: `sensor.rehau_kitchen_humidity`

All entities are automatically discovered via MQTT and will appear within a few minutes of starting the add-on.

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
   ```
   ```text
   [paste your log excerpt here]
   ```
   ```

### What to Include in Bug Reports

When reporting issues, please include:

1. **Add-on version** (found in the add-on info page)
2. **Home Assistant version**
3. **Relevant log excerpt** (with sensitive data reviewed)
4. **Steps to reproduce** the issue
5. **Expected vs actual behavior**

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

## Developer Tools

### API Response Parsers

This project includes standalone parsers for REHAU API responses. Use them to analyze API dumps for debugging and support:

```bash
# Parse user data from JSON file
npm run parseUserData -- user-data.json
npm run parseUserData -- user-data.json --summary

# Parse installation data from JSON file
npm run parseInstallationData -- installation-data.json
npm run parseInstallationData -- installation-data.json --summary
```

See [src/parsers/README.md](src/parsers/README.md) for complete documentation.

## Support

For issues and feature requests, please visit:
https://github.com/manuxio/rehau-nea-smart-2-home-assistant/issues

**Before opening an issue:**
1. Enable debug mode and review logs
2. Check existing issues for similar problems
3. Include all required information (see "What to Include in Bug Reports" above)
