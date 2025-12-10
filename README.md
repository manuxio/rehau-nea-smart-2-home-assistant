# REHAU NEA SMART 2.0 - Home Assistant Add-on

![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-20.14-green.svg?logo=node.js)
![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg?logo=docker)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)
![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Add--on-orange.svg?logo=home-assistant)
![MQTT](https://img.shields.io/badge/MQTT-Bridge-brightgreen.svg)

TypeScript-based MQTT bridge for REHAU NEA SMART 2.0 heating systems with Home Assistant integration.

> **⚠️ DISCLAIMER:** This is an unofficial, community-developed integration. It is **NOT affiliated with, endorsed by, or supported by REHAU AG or REHAU Industries SE & Co. KG**. REHAU® and NEA SMART® are registered trademarks of REHAU. Use this software at your own risk.

> **🚨 CRITICAL: Version 2.3.3 REQUIRES CLEAN REINSTALL**
>
> This version fixes a critical zone mapping bug but requires complete removal and reinstallation.
> **YOU MUST DELETE ALL EXISTING REHAU ENTITIES BEFORE UPGRADING.**
> See [Migration Guide](#-migration-guide-v233) below.

---

## 🚨 BREAKING CHANGES - Version 2.3.3

### What's Fixed

**Critical Bug:** Zones with duplicate numbers across different controllers were overwriting each other's data.

**Example Problem:**
- Controller 0, Zone 0 → "Living Room" (temperature: 20°C)
- Controller 1, Zone 0 → "Bedroom" (temperature: 18°C)
- **BUG:** Both zones shared the same MQTT topic, causing temperature readings to alternate

**Solution:** Each zone now uses its unique MongoDB ObjectId for identification.

### MQTT Topic Changes

| Version | Topic Format | Example |
|---------|-------------|----------|
| **< 2.3.3** | `homeassistant/climate/rehau_{installId}_zone_{zoneNumber}/...` | `homeassistant/climate/rehau_6ba02d11..._zone_0/current_temperature` |
| **≥ 2.3.3** | `homeassistant/climate/rehau_{zoneId}/...` | `homeassistant/climate/rehau_6595d1d5cceecee9ce9772e1/current_temperature` |

**Impact:** All MQTT topics have changed. Old entities will become unavailable.

---

## 📋 Migration Guide (v2.3.3)

### ⚠️ REQUIRED STEPS - DO NOT SKIP

#### Step 1: Backup Your Configuration
```bash
# Backup automations and scripts that use REHAU entities
# You'll need to update entity IDs after migration
```

#### Step 2: Uninstall Add-on
1. Go to **Settings** → **Add-ons** → **REHAU NEA SMART MQTT Bridge**
2. Click **Uninstall**
3. Wait for complete removal

#### Step 3: Remove Old Entities

**Option A: Via Home Assistant UI (Recommended)**
1. Go to **Settings** → **Devices & Services** → **MQTT**
2. Find all REHAU devices
3. Click each device → **Delete Device**
4. Repeat for all REHAU zones

**Option B: Via MQTT Explorer/CLI**
```bash
# Delete all REHAU discovery topics
mosquitto_pub -h localhost -t "homeassistant/climate/rehau_+/config" -n -r
mosquitto_pub -h localhost -t "homeassistant/sensor/rehau_+/config" -n -r
mosquitto_pub -h localhost -t "homeassistant/light/rehau_+/config" -n -r
mosquitto_pub -h localhost -t "homeassistant/lock/rehau_+/config" -n -r
```

#### Step 4: Reinstall Add-on
1. Go to **Settings** → **Add-ons** → **Add-on Store**
2. Find **REHAU NEA SMART MQTT Bridge**
3. Click **Install**
4. Configure with your REHAU credentials (see [Configuration](#-configuration) below)
5. Start the add-on

#### Step 5: Verify New Entities
1. Go to **Settings** → **Devices & Services** → **MQTT**
2. New REHAU devices should appear automatically
3. Check that all zones are present and showing correct temperatures

#### Step 6: Update Automations & Scripts
- Entity IDs have changed (see [Entity Reference](rehau-nea-smart-mqtt-bridge/docs/ENTITY_REFERENCE.md))
- Update all references in automations, scripts, and dashboards

---

## 📦 Quick Installation

### Home Assistant OS Add-on

1. Add repository: `https://github.com/manuxio/rehau-nea-smart-2-home-assistant`
2. Install **REHAU NEA SMART 2.0 MQTT Bridge** from Add-on Store
3. Configure with your REHAU credentials
4. Start the add-on

**📖 Detailed Instructions:** [Installation Guide](rehau-nea-smart-mqtt-bridge/docs/INSTALLATION.md#home-assistant-os-add-on)

### Home Assistant Core (Docker)

Deploy as a Docker container alongside Home Assistant Core.

**📖 Detailed Instructions:** [Installation Guide](rehau-nea-smart-mqtt-bridge/docs/INSTALLATION.md#home-assistant-core-docker)

### Standalone Docker

Run the bridge as a standalone Docker container.

**📖 Detailed Instructions:** [Installation Guide](rehau-nea-smart-mqtt-bridge/docs/INSTALLATION.md#standalone-docker)

---

## 🔧 Configuration

### Quick Configuration

**Home Assistant OS Add-on:**
```yaml
rehau_email: "your@email.com"
rehau_password: "yourpassword"
mqtt_host: "core-mosquitto"
mqtt_port: 1883
```

**Docker/Standalone:**
```bash
REHAU_EMAIL=your@email.com
REHAU_PASSWORD=yourpassword
MQTT_HOST=localhost
MQTT_PORT=1883
```

**📖 Complete Configuration Reference:** [Configuration Guide](rehau-nea-smart-mqtt-bridge/DOCS.md)

---

## ✨ Features

### Climate Control
- **Climate entities** for each heating zone with full thermostat control
- **Separate temperature and humidity sensors** per zone
- **Outside temperature sensor** for the installation
- **Installation-wide mode control** (heat/cool switching)
- **Ring light control** per zone (light entity)
- **Lock control** per zone (lock entity)
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

---

## 📊 Entity Naming

Entity IDs follow a consistent naming pattern:
- Climate: `climate.rehau_{installation}_{group}_{zone}`
- Sensors: `sensor.rehau_{group}_{zone}_{type}`
- Controls: `light.rehau_{installation}_{group}_{zone}_ring_light`

MQTT topics use unique zone IDs (MongoDB ObjectIds) for identification.

**📖 Complete Entity Reference:** [Entity Reference Guide](rehau-nea-smart-mqtt-bridge/docs/ENTITY_REFERENCE.md)

---

## 🐛 Troubleshooting

### Quick Fixes

**Add-on won't start:**
- Check Log tab for error messages
- Verify REHAU credentials are correct
- Ensure MQTT broker is running

**No entities appearing:**
- Check MQTT integration is configured in Home Assistant
- Wait a few minutes for discovery
- Enable debug mode: `log_level: "debug"`

**Entities show as unavailable:**
- Check MQTT broker is running
- Verify MQTT credentials
- Restart the bridge

**📖 Complete Troubleshooting Guide:** [Troubleshooting Guide](rehau-nea-smart-mqtt-bridge/docs/TROUBLESHOOTING.md)

---

## 📚 Documentation

### Main Documentation
- **[Installation Guide](rehau-nea-smart-mqtt-bridge/docs/INSTALLATION.md)** - Detailed installation instructions
- **[Configuration Reference](rehau-nea-smart-mqtt-bridge/DOCS.md)** - Complete configuration options
- **[Entity Reference](rehau-nea-smart-mqtt-bridge/docs/ENTITY_REFERENCE.md)** - Entity naming and MQTT topics
- **[Troubleshooting Guide](rehau-nea-smart-mqtt-bridge/docs/TROUBLESHOOTING.md)** - Common issues and solutions

### Additional Documentation
- **[CHANGELOG](rehau-nea-smart-mqtt-bridge/CHANGELOG.md)** - Version history and release notes
- **[Parser Documentation](rehau-nea-smart-mqtt-bridge/src/parsers/README.md)** - API response parser tools
- **[Configuration Validation Testing](rehau-nea-smart-mqtt-bridge/docs/TEST_CONFIG_VALIDATION.md)** - Testing configuration validation

---

## 🛠️ Developer Tools

This project includes standalone parsers for REHAU API responses:

```bash
# Parse user data from JSON file
npm run parseUserData -- user-data.json
npm run parseUserData -- user-data.json --summary

# Parse installation data from JSON file
npm run parseInstallationData -- installation-data.json
npm run parseInstallationData -- installation-data.json --summary
```

See [Parser Documentation](rehau-nea-smart-mqtt-bridge/src/parsers/README.md) for details.

---

## 🚀 Future Enhancements

Planned features for future releases:

1. **Schedule/Program Support** (High Priority) - Auto mode integration and schedule display
2. **Party Mode** (Medium Priority) - Local and global party mode with duration control
3. **Advanced Mode Support** (Medium Priority) - Manual mode, global absence, holiday mode
4. **Enhanced Setpoint Management** (Low Priority) - Standby setpoint display and history
5. **System Mode Detection** (Low Priority) - Operating mode display and recommendations

**🤝 Contributing:** Check [GitHub Issues](https://github.com/manuxio/rehau-nea-smart-2-home-assistant/issues) for related discussions and contribute!

---

## 💬 Support

For issues and feature requests, please visit:
https://github.com/manuxio/rehau-nea-smart-2-home-assistant/issues

**Before opening an issue:**
1. Enable debug mode (`log_level: "debug"`) and review logs
2. Check existing issues for similar problems
3. Include bridge version, Home Assistant version, and relevant log excerpts
4. Review the [Troubleshooting Guide](rehau-nea-smart-mqtt-bridge/docs/TROUBLESHOOTING.md)

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

This project is a community effort to integrate REHAU NEA SMART 2.0 systems with Home Assistant. Special thanks to all contributors and users who have helped improve this integration.

**Remember:** This is an unofficial integration not affiliated with REHAU.
