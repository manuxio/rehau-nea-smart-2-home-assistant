# Features

This document provides an overview of all features available in the REHAU NEA SMART MQTT Bridge.

## Climate Control

- **Climate entities** for each heating zone with full thermostat control
- **Separate temperature and humidity sensors** per zone
- **Outside temperature sensor** for the installation
- **Installation-wide mode control** (heat/cool switching)
- **Ring light control** per zone (light entity)
- **Lock control** per zone (lock entity)
- **Optimistic mode** for instant UI feedback

## LIVE Data Monitoring (v2.1.0+)

- **Mixed Circuit sensors** - Setpoint, supply, return temperatures, valve opening, pump state
- **Digital I/O sensors** - DI0-DI4, DO0-DO5 for advanced monitoring
- **Periodic polling** - Auto-refresh every 5 minutes (configurable)
- **Diagnostic entities** - Hidden by default, visible in device diagnostics

## System Features

- **Real-time MQTT updates** from REHAU system
- **Configurable update intervals** for zones, tokens, and referentials
- **Automatic token refresh** with fallback to fresh login
- **Enhanced debug logging** with sensitive data redaction
- **TypeScript implementation** with strict type safety
- **Comprehensive obfuscation** of sensitive data in info-level logs

## Entity Types

The bridge creates the following entity types in Home Assistant:

### Climate Entities
- Full thermostat control for each zone
- Temperature setpoint control
- Mode switching (heat/cool/off)
- Preset control (comfort/away)

### Sensor Entities
- Temperature sensors per zone
- Humidity sensors per zone
- Outside temperature sensor
- Demanding sensors (binary and percentage)
- Dewpoint sensors
- Mixed circuit sensors (v2.1.0+)
- Digital I/O sensors (v2.1.0+)

### Control Entities
- Ring light control (light entity)
- Zone lock control (lock entity)

For detailed information about entity naming and structure, see the [Entity Naming Guide](./entities.md).

## Related Documentation

- [Entity Naming Guide](./entities.md) - How entities are named and structured
- [Configuration Guide](./configuration.md) - How to configure features
- [Future Enhancements](./future-enhancements.md) - Planned features
