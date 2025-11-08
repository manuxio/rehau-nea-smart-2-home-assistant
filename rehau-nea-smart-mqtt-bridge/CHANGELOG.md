# Changelog

## [2.4.0] - 2025-11-08

### 🔧 Fixed - CRITICAL: REHAU Command Message Structure

**This version fixes a critical bug in how commands are sent to the REHAU system.**

#### What Was Wrong
Commands were using incorrect zone and controller identifiers:
- Used `zone.number` (zone's position in group) instead of `channel.channelZone` (actual channel zone number)
- Controller number was always `undefined` or defaulting to `0`

#### What's Fixed Now
Commands now correctly use:
- **Key "36" (zone):** `channel.channelZone` - the actual channel's zone number (e.g., 0, 1, 2)
- **Key "35" (controller):** `channel.controllerNumber` - the actual controller number (e.g., 0)

#### Message Structure
```json
{
  "11": "REQ_TH",
  "36": <channelZone>,      // ✅ Correct channel zone number
  "35": <controllerNumber>, // ✅ Correct controller number
  "12": {
    "<command_key>": <value>
  }
}
```

### Changed
- **Ring Light & Lock Commands**
  - Ring light uses `ring_function` referential (index 34): `1` = ON, `0` = OFF
  - Lock uses `loc_activation` referential (index 31): `true` = LOCKED, `false` = UNLOCKED
  - Both use dynamic referential lookup with fallback values
  
- **Improved Logging**
  - Added `convertMessageToTextualKeys()` function
  - Logs now show human-readable referential names instead of numeric keys
  - Example: `"type": "REQ_TH"` instead of `"11": "REQ_TH"`
  - Full command messages logged at info level for debugging

### Technical Details
- Updated `ClimateState` and `ExtendedZoneInfo` interfaces
- Added `channelZone` and `controllerNumber` fields
- Extract values from `channel.channelZone` and `channel.controllerNumber`
- Updated all command types: mode, preset, temperature, ring_light, lock
- `RehauCommandData` now accepts boolean values

## [2.3.5] - 2025-11-07

### Fixed
- **Ring Light & Lock Command Fix**
  - Fixed ring light to use correct referential 'ring_function' (index 34) instead of 'loc_activation'
  - Fixed lock to use correct referential 'loc_activation' (index 31)
  - Ring light: 1 = ON, 0 = OFF
  - Lock: 1 = LOCKED, 0 = UNLOCKED
  - Both now use dynamic referential lookup with fallback values
  - Added full command data logging for debugging

## [2.3.4] - 2025-11-07

### Changed
- **Documentation Consolidation**
  - Merged both README files into single comprehensive README in repository root
  - Added disclaimer: Not affiliated with REHAU AG
  - Removed duplicate documentation
  - Improved navigation and structure

## [2.3.3] - 2025-11-07

### 🚨 BREAKING CHANGES - REQUIRES CLEAN REINSTALL

**⚠️ This version contains breaking changes. You MUST:**
1. **Delete all existing REHAU entities** from Home Assistant before upgrading
2. **Remove the add-on completely** and reinstall from scratch
3. All MQTT topics have changed - old entities will become unavailable

### Fixed
- **Critical Bug Fix: Zone Mapping Collision**
  - Fixed issue where zones with duplicate numbers across different controllers would overwrite each other
  - Changed zone identification from `zone.number` to `zone.id` (MongoDB ObjectId) for unique identification
  - Resolves temperature readings being published to wrong zones in multi-controller installations
  - Example: Previously Zone_1 (controller 0, zone 0) and Zone_7 (controller 1, zone 0) would conflict
  - Now each zone is uniquely identified regardless of controller or zone number

### Changed
- **Simplified MQTT Topic Structure**
  - **OLD:** `homeassistant/climate/rehau_{installId}_zone_{zoneNumber}/...`
  - **NEW:** `homeassistant/climate/rehau_{zoneId}/...`
  - Topics now use only the unique zone ID (MongoDB ObjectId)
  - Cleaner, shorter topics that are truly unique
  - Applies to all entity types: climate, sensors, lights, locks

### Migration Guide
See README.md for detailed migration instructions and entity naming table.

## [2.3.2] - 2025-11-07

### Changed
- Increased zone_reload_interval maximum from 3600 to 86400 seconds (24 hours)
  - Allows users to set longer polling intervals if desired
  - Reduces API calls for installations that don't need frequent updates

## [2.3.1] - 2025-11-07

### Improved
- **Enhanced MQTT Logging** - Comprehensive logging for all data flows
  - Added detailed logging when updates are received from REHAU MQTT
  - Added detailed logging when updates are received from REHAU HTTPS API
  - Added detailed logging when publishing updates to Home Assistant MQTT
  - All logs now include: MQTT Topic, Group Name, Zone Name, Entity Type, and Value
  - Easy to track data flow: REHAU → Bridge → Home Assistant
  - Improved debugging capabilities for specific zones or groups
- **Enhanced LIVE Data Logging** - Detailed visibility for system monitoring
  - LIVE_EMU (Mixed Circuits): Shows pump state, setpoint, supply/return temps, valve opening
  - LIVE_DIDO (Digital I/O): Shows all DI/DO states with ON/OFF values
  - Installation name, circuit/controller counts, and all sensor values logged
  - Clear indication when data is received and published to Home Assistant
- **Group Name Tracking**
  - REHAU MQTT messages now display group name alongside zone name
  - Group names stored and retrieved for all logging operations
  - Better context for multi-group installations
- **Privacy Protection at Info Level**
  - Comprehensive obfuscation system with consistent name replacement
  - Email addresses: `manu@cappelleri.net` → `user1@example.com`
  - Installation names: `My Home` → `Installation_1`
  - Group names: `Ground Floor` → `Group_1`
  - Zone names: `Living Room` → `Zone_1`
  - All occurrences replaced consistently throughout logs
  - Full details visible at debug level for troubleshooting
  - Safer to share logs without exposing personal information

### Fixed
- Fixed entity tree formatting - vertical lines now consistent for all sensors

### Example Logs (Info Level - Obfuscated)
```
📨 REHAU MQTT Update:
   Channel: abc123def456
   Group: Group_1
   Zone: Zone_1
   Install: 9f8e7d6c...
   Updates: temp=21.5°C, humidity=45%

📤 MQTT Publish:
   Topic: homeassistant/climate/rehau_abc123/current_temperature
   Group: Group_1
   Zone: Zone_1
   Entity: current_temperature
   Value: 21.5°C

🔌 LIVE_EMU Data Received:
   Installation: Installation_1
   Circuits: 2
🔌 MC1 Data:
   Pump: ON
   Setpoint: 35.0°C
   Supply: 34.5°C
   Return: 32.0°C
   Valve Opening: 75%
📤 Published MC1 to HA:
   Topics: pump, setpoint, supply, return, opening

🔌 LIVE_DIDO Data Received:
   Installation: Installation_1
   Controllers: 1
🔌 Controller1:
   Digital Inputs: 5
   Digital Outputs: 6
   DI States: DI0=OFF, DI1=ON, DI2=OFF, DI3=OFF, DI4=ON
   DO States: DO0=ON, DO1=OFF, DO2=ON, DO3=OFF, DO4=OFF, DO5=ON

📨 REHAU: errorMessagesSettingsSearch message on client/user1@example.com
```

## [2.3.0] - 2025-11-05

### 🔴 **Critical Bug Fix**
- **Fixed zone collision bug for installations with multiple groups**
  - Zones with same number in different groups were overwriting each other
  - Example: Upstairs Zone 0 (Landing) + Downstairs Zone 0 (Kitchen) → only Kitchen visible
  - Used non-unique zone numbers in MQTT topics causing collisions
  
### Fixed
- Changed MQTT topics from `zone_${zoneNumber}` to `rehau_${zoneId}` (unique channel ID)
- All zones now have unique MQTT topics regardless of group
- Fixed duplicate subscriptions (same topic subscribed multiple times)
- Fixed missing zones (zones were being overwritten by later zones with same number)

### Impact
- **Before**: Installations with 9 zones might only see 6-7 zones
- **After**: All zones visible and functional
- **Breaking**: MQTT topics changed, users need to restart add-on (HA will auto-discover new topics)

### Example Fix
**Before (BROKEN)**:
- `homeassistant/climate/rehau_6ba0..._zone_0/` → Used by 3 different zones (collision!)

**After (FIXED)**:
- `homeassistant/climate/rehau_6595d1d5cceecee9ce9772e1/` → Landing (unique)
- `homeassistant/climate/rehau_6595d1e16c9645c4cf338302/` → Kitchen (unique)
- `homeassistant/climate/rehau_6618fa32839d609d2e344339/` → Bedroom 5 (unique)

## [2.2.7] - 2025-11-05

### Improved
- Added verbose debug logging to API response parsers
- UserDataParserV2 now logs detailed parsing steps in debug mode
  - User information (ID, email, language, roles)
  - Geofencing data
  - Each installation being parsed with name and connection state
- InstallationDataParserV2 now logs detailed parsing steps in debug mode
  - User information
  - Total installations in response
  - Each installation with groups, zones, controllers, and mixed circuits
  - Filtering operations when targeting specific installations
- All parser logs use 🔍 emoji for easy identification
- Helps troubleshoot API response parsing issues

## [2.2.6] - 2025-11-05

### Improved
- Added emojis to all remaining log messages for consistency
- Installation subscription logs now have emojis (📡 📥 ✅)
- Startup sequence logs now have emojis (🔐 📍 🔌 🚀)
- Shutdown logs now have emojis (🛑)
- All info-level logs now have visual indicators for easy scanning

## [2.2.5] - 2025-11-05

### Improved
- Shortened timestamp format from ISO to [HH:mm:ss] for cleaner logs
- All MQTT log messages now clearly specify which broker (REHAU or Home Assistant)
- Added visual emojis for better log scanning (🔌 ✅ 🔄 ⚠️ 📴 ❌ ⏳ 📊 📋)
- Fixed duplicate log line in HA subscription
- Improved template string formatting

## [2.2.4] - 2025-11-05

### Fixed
- **Critical**: Fixed MQTT reconnection subscription handling
  - Subscriptions now properly restored after reconnection
  - Previously lost messages after MQTT broker reconnects
  - Both REHAU and Home Assistant MQTT affected
- Enhanced reconnection logging with emojis for better visibility
  - ✅ Initial connection vs 🔄 Reconnection clearly distinguished
  - 📊 Shows subscription count on close/reconnect
  - 📴 Added offline event detection
  - ⚠️ Connection state changes clearly logged

### Added
- MQTT ping/keepalive test results documentation
- Verified both brokers support standard MQTT keepalive (60s interval)
- Added offline event handlers for better connection monitoring

## [2.2.3] - 2025-11-05

### Fixed
- Corrected config.yaml schema format to match Home Assistant requirements
- Fixed repository validation errors preventing add-on installation
- Schema now uses proper HA types (email, password, port, list, int ranges)

## [2.2.2] - 2025-11-05

### Improved
- Added user-friendly labels and descriptions to all configuration options
- Configuration UI now shows clear names instead of technical variable names
- Each option includes helpful descriptions with defaults and valid ranges
- Much easier to understand what each setting does

## [2.2.1] - 2025-11-05

### Fixed
- Changed maintainer attribution from "REHAU" to "DomoDreams"
- Added documentation URL to config.yaml

### Documentation
- Added comprehensive DOCS.md with detailed configuration explanations
- Added prominent breaking changes warning to main repository README
- All configuration options now documented with examples and troubleshooting
- Documentation accessible directly in Home Assistant add-on UI

## [2.2.0] - 2025-11-05

### ⚠️ BREAKING CHANGES
- **Entity IDs have changed** for better consistency and future compatibility
  - Climate entities: `climate.rehau_<install>_<group>_<zone>` (always includes group name)
  - Sensor entities: `sensor.rehau_<group>_<zone>_<type>` (always includes group name)
  - Lock entities: `lock.rehau_<group>_<zone>_lock` (changed from switch to lock platform)
  - Light entities: `light.rehau_<group>_<zone>_ring_light`
  - **Migration required**: Update automations, dashboards, and scripts with new entity IDs

### Added
- **V2 Parsers with Typed Interfaces**
  - Complete TypeScript interfaces for all REHAU data structures
  - Runtime validation ensures data integrity
  - Pre-converted temperatures (Celsius) in typed objects
  - `getTyped()` method returns clean objects without raw fields
  - `getSummary()` method for human-readable output
- **Ring Light Control** (new entity per zone)
  - Control LED ring on physical thermostats
  - Entity: `light.rehau_<group>_<zone>_ring_light`
  - Real-time state updates from REHAU
- **Lock Control** (new entity per zone)
  - Lock/unlock manual control on physical thermostats
  - Entity: `lock.rehau_<group>_<zone>_lock` (proper lock platform)
  - Prevents unauthorized changes when locked
- **MQTT Structure Tree Visualization**
  - Prints complete entity structure after initialization
  - Shows all topics, entity IDs, and current states
  - Displays after each zone reload cycle
- **Enhanced REHAU MQTT Logging**
  - Detailed info-level logging for all REHAU messages
  - Shows exactly what changed (temp, setpoint, mode, ring light, lock)
  - Human-readable mode names (comfort, away, standby, off)
  - Example: `Updates: setpoint_heat=22.0°C, mode=comfort, ring_light=ON`
- **USE_GROUP_IN_NAMES Configuration**
  - Controls display names (not entity IDs)
  - `false`: Display names show only zone (e.g., "Salone")
  - `true`: Display names include group (e.g., "Atilio Salone")
  - Entity IDs always include group name for consistency

### Fixed
- **MQTT Subscription Handling**
  - Subscriptions now queued even when HA MQTT not connected yet
  - Automatic resubscription on reconnection
  - Ring light and lock commands now properly received
- **Entity Platform Issues**
  - Lock now uses proper `lock` platform (was `switch`)
  - Lock states: LOCKED/UNLOCKED (was ON/OFF)
  - Lock commands: LOCK/UNLOCK (was ON/OFF)
  - Light now uses default MQTT light schema with explicit icon
  - Fixed "thunder" icon issue - entities now show proper icons
- **Entity ID Consistency**
  - Group names always included in entity IDs
  - Stable zone IDs used in MQTT topics
  - No more duplicate installation names in entity IDs
  - Hierarchical naming: install → group → zone

### Changed
- **All Controllable Entities Set to Optimistic**
  - Climate controls (mode, preset, temperature)
  - Ring light switch
  - Lock switch
  - Instant UI feedback without waiting for confirmation
- **MQTT Topic Structure**
  - Sensors use zone IDs: `homeassistant/sensor/rehau_<zoneId>_<type>/`
  - Locks use lock platform: `homeassistant/lock/rehau_<zoneId>_lock/`
  - Cleaner, more stable topic paths
- **Documentation**
  - Comprehensive entity types table in README
  - BREAKING CHANGES section with migration guide
  - Updated all examples to use "domodreams" (was "cappelleri")
  - Clear explanation of entity IDs vs display names

### Developer
- Migrated entire application to use V2 parsers
- Separate handlers for typed data vs raw MQTT data
- Better type safety throughout the codebase
- Runtime validation prevents raw fields from leaking through

## [2.1.0] - 2025-11-04

### Added
- **LIVE Data Sensors** - Real-time system monitoring
  - Mixed Circuit sensors (setpoint, supply, return temperatures, valve opening, pump state)
  - Digital I/O sensors (DI0-DI4, DO0-DO5)
  - All sensors marked as diagnostic entities (hidden by default)
  - Automatic MQTT discovery in Home Assistant
- **Periodic LIVE Data Polling**
  - Automatic refresh every 5 minutes (configurable via `LIVE_DATA_INTERVAL`)
  - Only polls when connected to REHAU MQTT
  - Keeps sensor values up-to-date
- **Enhanced Debug Logging**
  - Full message dumps when `LOG_LEVEL=debug`
  - Sensitive data redaction (passwords, tokens, emails, addresses)
  - Circular reference handling in JSON serialization
  - Startup warning about potential data exposure in debug mode
  - HTTP response logging (status, headers, body)
  - Condensed logging for large data structures

### Fixed
- MQTT re-subscription on reconnection for both REHAU and Home Assistant
- HTTP 418 errors by correcting request headers (Origin, Referer, User-Agent)
- LOG_LEVEL environment variable not being read (dotenv loading order)
- Circular JSON serialization errors in logger
- LIVE_DIDO crash when DI/DO arrays are undefined (added safety checks)
- Installation name in device identifiers (was showing ID instead of name)
- Temperature conversion for Mixed Circuit sensors (Fahrenheit to Celsius)
- Reduced log noise (config dumps only at debug level)

### Changed
- Retained MQTT messages for sensor states (persist across HA restarts)
- LIVE data request logging changed from info to debug level
- Better error handling throughout the application

### Security
- Sensitive data redaction in debug logs
  - Passwords, tokens, API keys redacted
  - Email addresses partially masked
  - Installation addresses and coordinates redacted
  - User data structure preserved while hiding sensitive fields

## [2.0.2] - 2025-11-04

### Fixed
- Re-publish MQTT discovery configs on every zone reload to ensure persistence
- Outside temperature sensor discovery now refreshes periodically
- Zone climate and sensor discovery configs refresh every 5 minutes (configurable)
- Improved resilience to MQTT broker restarts

## [2.0.1] - 2025-11-04

### Fixed
- Fixed MQTT authentication handling for optional credentials
- Improved Mosquitto broker compatibility
- Better handling of empty MQTT username/password

### Changed
- Updated documentation with MQTT broker setup requirements

## [2.0.0] - 2025-11-04

### Added
- Full TypeScript implementation with strict typing
- Configurable intervals via environment variables
  - Zone reload interval (default: 5 minutes)
  - Token refresh interval (default: 6 hours)
  - Referentials reload interval (default: 24 hours)
- Fresh login on every boot (no token persistence)
- Automatic token refresh with fallback to fresh login
- Optimistic mode for instant UI feedback
- Separate temperature and humidity sensors per zone
- Outside temperature sensor
- Installation-wide mode control

### Changed
- Converted from JavaScript to TypeScript
- Improved error handling and logging
- Better MQTT connection management

## [1.0.0] - 2025-11-03

### Added
- Initial release
- REHAU NEA SMART 2.0 authentication
- MQTT bridge between REHAU and Home Assistant
- Home Assistant MQTT Climate integration
- REST API for direct control
- Automatic MQTT discovery
- Real-time temperature and mode updates
