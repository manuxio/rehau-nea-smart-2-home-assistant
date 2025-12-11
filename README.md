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
> See [Migration Guide](./docs/migration.md) for detailed steps.

---

## Quick Start

### Home Assistant OS (Add-on)

1. Add repository: `https://github.com/manuxio/rehau-nea-smart-2-home-assistant`
2. Install **REHAU NEA SMART 2.0 MQTT Bridge** from the Add-on Store
3. Configure with your REHAU credentials (see [Configuration Guide](./docs/configuration.md))
4. Start the add-on

### Home Assistant Core (Docker)

See the [Installation Guide](./docs/installation.md) for detailed Docker setup instructions.

---

## Documentation

📚 **Full documentation is available in the [docs](./docs/) folder:**

- **[Installation Guide](./docs/installation.md)** - Step-by-step installation for HA OS and Core
- **[Configuration Guide](./docs/configuration.md)** - All configuration options explained
- **[Migration Guide](./docs/migration.md)** - Migrating from v2.3.2 or earlier
- **[Features Guide](./docs/features.md)** - Overview of available features
- **[Entity Naming Guide](./docs/entities.md)** - How entities are structured
- **[Troubleshooting Guide](./docs/troubleshooting.md)** - Common issues and solutions
- **[Breaking Changes](./docs/breaking-changes.md)** - Version 2.3.3 changes
- **[Development Guide](./docs/development.md)** - Developer tools
- **[Future Enhancements](./docs/future-enhancements.md)** - Planned features

---

## Features

- **Climate Control** - Full thermostat control for each heating zone
- **Temperature & Humidity Sensors** - Separate sensors per zone
- **Ring Light Control** - Control zone ring lights
- **Lock Control** - Lock/unlock zones
- **LIVE Data Monitoring** - Mixed circuit and digital I/O sensors (v2.1.0+)
- **Real-time MQTT Updates** - Automatic synchronization with REHAU system
- **Optimistic Mode** - Instant UI feedback

See the [Features Guide](./docs/features.md) for complete details.

---

## Support

For issues and feature requests, please visit:
https://github.com/manuxio/rehau-nea-smart-2-home-assistant/issues

**Before opening an issue:**
1. Enable debug mode (`log_level: "debug"`) and review logs
2. Check existing issues for similar problems
3. Include add-on version, Home Assistant version, and relevant log excerpts
4. Review the [Troubleshooting Guide](./docs/troubleshooting.md)

---

## License

MIT License - See LICENSE file for details

---

## Acknowledgments

This project is a community effort to integrate REHAU NEA SMART 2.0 systems with Home Assistant. Special thanks to all contributors and users who have helped improve this integration.

**Remember:** This is an unofficial integration not affiliated with REHAU.
