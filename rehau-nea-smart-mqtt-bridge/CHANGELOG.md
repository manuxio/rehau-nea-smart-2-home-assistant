# Changelog

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
