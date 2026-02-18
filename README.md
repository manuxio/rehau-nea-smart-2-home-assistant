# REHAU NEA SMART 2.0 - Home Assistant Add-on

```
              .-.
             (o.o)
              |=|
             __|__
           //.=|=.\\
          // .=|=. \\
          \\ .=|=. //
           \\(_=_)//
            (:| |:)
             || ||
             () ()
             || ||
             || ||
            ==' '==
```
*Dear REHAU: Thanks for the Cloudflare bot detection. Here's what we think of that.*

![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-20.14-green.svg?logo=node.js)
![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg?logo=docker)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)
![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Add--on-orange.svg?logo=home-assistant)
![MQTT](https://img.shields.io/badge/MQTT-Bridge-brightgreen.svg)

TypeScript-based MQTT bridge for REHAU NEA SMART 2.0 heating systems with Home Assistant integration and automatic 2FA support.

> **⚠️ DISCLAIMER:** This is an unofficial, community-developed integration. It is **NOT affiliated with, endorsed by, or supported by REHAU AG or REHAU Industries SE & Co. KG**. REHAU® and NEA SMART® are registered trademarks of REHAU. Use this software at your own risk.

> **🚨 BREAKING CHANGES: Version 3.5.0 - The Cloudflare Saga**
>
> **REHAU deployed aggressive Cloudflare bot protection that blocked all legitimate API access.** After extensive debugging, we discovered they're serving JavaScript challenges that can't be executed by standard HTTP clients. We had to implement a curl-based workaround because curl's TLS fingerprint bypasses their detection.
>
> **What REHAU Did:**
> 1. **Mandatory 2FA** - Introduced email-based 2FA for every login (February 2026)
> 2. **Cloudflare Bot Protection** - Deployed aggressive bot detection that blocks Node.js HTTPS requests
> 3. **JavaScript Challenges** - Serves "Just a moment..." pages that standard HTTP clients can't execute
>
> **What We Had To Do:**
> 1. Implement automatic POP3 email polling for 2FA codes
> 2. Replace the entire HTTP client with curl-based implementation to bypass Cloudflare's TLS fingerprinting
> 3. Spend countless hours debugging 403 errors in Docker environments
>
> **The Technical Details:**
> - Node.js native `https` module: ❌ Blocked by Cloudflare (403)
> - Axios library: ❌ Blocked by Cloudflare (403)
> - curl command-line tool: ✅ Works (bypasses TLS fingerprinting)
>
> This is why version 3.5.0 uses curl via child_process instead of proper HTTP libraries. Not our first choice, but REHAU forced our hand.
>
> **Required Setup:**
> 1. Create a POP3 email account (we recommend [GMX.de](https://www.gmx.de) - it's German and free)
> 2. Set up email forwarding from `noreply@accounts.rehau.com` to your POP3 account
> 3. Add POP3 credentials to your configuration
>
> See [Full Setup Guide](./rehau-nea-smart-mqtt-bridge/README.md#-breaking-changes---version-350-february-2026) for detailed instructions.

---

## Quick Start

### Home Assistant OS (Add-on)

1. Add repository: `https://github.com/manuxio/rehau-nea-smart-2-home-assistant`
2. Install **REHAU NEA SMART 2.0 MQTT Bridge** from the Add-on Store
3. **Set up POP3 email account** for 2FA (see breaking change notice above)
4. Configure with your REHAU and POP3 credentials (see [Configuration Guide](./docs/configuration.md))
5. Start the add-on

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
