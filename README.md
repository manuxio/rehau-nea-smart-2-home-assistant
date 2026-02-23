# REHAU NEA SMART 2.0 - Home Assistant Integration

<div align="center">

![Version](https://img.shields.io/badge/Version-5.1.7-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg?logo=node.js)
![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg?logo=docker)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)
![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Add--on-orange.svg?logo=home-assistant)
![MQTT](https://img.shields.io/badge/MQTT-Bridge-brightgreen.svg)

**Professional MQTT bridge and web interface for REHAU NEA SMART 2.0 heating systems**

[Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Screenshots](#-screenshots) • [Support](#-support)

</div>

---

## 📋 Overview

This project provides a complete integration solution for REHAU NEA SMART 2.0 heating systems with Home Assistant. It features:

- **MQTT Bridge** - Real-time bidirectional communication with REHAU cloud
- **Modern Web UI** - Progressive Web App with mobile-first design
- **REST API** - Complete programmatic access with Swagger documentation
- **Automatic 2FA** - Seamless email-based two-factor authentication
- **Home Assistant Discovery** - Zero-configuration entity creation

> **⚠️ DISCLAIMER:** This is an unofficial, community-developed integration. It is **NOT affiliated with, endorsed by, or supported by REHAU AG or REHAU Industries SE & Co. KG**. REHAU® and NEA SMART® are registered trademarks of REHAU. Use this software at your own risk.

---

## ✨ Features

### Core Functionality
- ✅ **Full Climate Control** - Temperature, modes, presets for all zones
- ✅ **Real-time Updates** - Instant synchronization via MQTT
- ✅ **Automatic Discovery** - Home Assistant entities created automatically
- ✅ **2FA Automation** - POP3-based automatic verification code handling
- ✅ **Cloudflare Bypass** - Playwright-based browser automation
- ✅ **Token Management** - Automatic refresh with 6-hour validity

### Web Interface
- 📱 **Progressive Web App** - Install on mobile/desktop
- 🎨 **Modern UI** - React + TypeScript with responsive design
- 🌓 **Dark Mode** - Eye-friendly interface
- 📊 **Real-time Dashboard** - System status and monitoring
- 🔐 **Secure Authentication** - JWT-based access control

### Advanced Features
- 🔄 **Staleness Detection** - Automatic data freshness monitoring
- 📈 **Resource Monitoring** - Memory and CPU usage tracking
- 📝 **Enhanced Logging** - Obfuscated, exportable logs
- 🔌 **OAuth2 Support** - Gmail and Outlook POP3 integration
- 🏥 **Health Checks** - System diagnostics and monitoring

---

## 🚀 Quick Start

### Home Assistant OS (Recommended)

1. **Add Repository**
   ```
   https://github.com/manuxio/rehau-nea-smart-2-home-assistant
   ```

2. **Install Add-on**
   - Navigate to Settings → Add-ons → Add-on Store
   - Find "REHAU NEA SMART 2.0 MQTT Bridge"
   - Click Install

3. **Configure**
   - Set REHAU credentials
   - Configure POP3 email for 2FA (see [2FA Setup](#2fa-setup))
   - Set MQTT broker details

4. **Start**
   - Enable "Start on boot" and "Watchdog"
   - Click Start

### Docker

> **Note**: Docker images are automatically published to GitHub Container Registry on every release. After pushing this workflow, images will be available at `ghcr.io/manuxio/rehau-nea-smart-2-home-assistant:latest`

```bash
# Build locally (until first GHCR image is published)
cd rehau-nea-smart-mqtt-bridge
docker build -t rehau-bridge .

# Or pull from GHCR (after first publish)
docker pull ghcr.io/manuxio/rehau-nea-smart-2-home-assistant:latest

# Run
docker run -d \
  --name rehau-bridge \
  -p 3000:3000 \
  -e REHAU_EMAIL=your@email.com \
  -e REHAU_PASSWORD=your_password \
  -e POP3_EMAIL=your@gmx.de \
  -e POP3_PASSWORD=pop3_password \
  -e POP3_HOST=pop.gmx.net \
  -e MQTT_HOST=your-mqtt-broker \
  -e API_PASSWORD=secure_password \
  rehau-bridge
  # Or: ghcr.io/manuxio/rehau-nea-smart-2-home-assistant:latest
```

### Standalone

```bash
git clone https://github.com/manuxio/rehau-nea-smart-2-home-assistant.git
cd rehau-nea-smart-2-home-assistant/rehau-nea-smart-mqtt-bridge
npm install
cp .env.example .env
# Edit .env with your credentials
npm run build
npm start
```

---

## 🔐 2FA Setup

REHAU requires email-based two-factor authentication. The bridge handles this automatically via POP3.

### Recommended: GMX.de

1. **Create Account** at [gmx.de](https://www.gmx.de) (free, German provider)
2. **Enable POP3** in settings
3. **Setup Forwarding** from `noreply@accounts.rehau.com` to your GMX account
4. **Configure Bridge**:
   ```env
   POP3_EMAIL=your@gmx.de
   POP3_PASSWORD=your_password
   POP3_HOST=pop.gmx.net
   POP3_PORT=995
   POP3_SECURE=true
   ```

### Alternative Providers

- **Gmail** - Requires OAuth2 (see [OAuth2 Setup](./rehau-nea-smart-mqtt-bridge/docs/OAUTH2_GMAIL_SETUP.md))
- **Outlook** - Requires OAuth2 (see [OAuth2 Setup](./rehau-nea-smart-mqtt-bridge/docs/OAUTH2_OUTLOOK_SETUP.md))
- **Any POP3 Provider** - Configure host/port accordingly

---

## 📸 Screenshots

### Mobile Web UI (iPhone 14)

<div align="center">

| Dashboard | Zones | Zone Detail |
|-----------|-------|-------------|
| ![Dashboard](./rehau-nea-smart-mqtt-bridge/docs/screenshots/02-dashboard.png) | ![Zones](./rehau-nea-smart-mqtt-bridge/docs/screenshots/03-zones.png) | ![Zone Detail](./rehau-nea-smart-mqtt-bridge/docs/screenshots/04-zone-detail.png) |

| System Status | Login |
|---------------|-------|
| ![System](./rehau-nea-smart-mqtt-bridge/docs/screenshots/05-system.png) | ![Login](./rehau-nea-smart-mqtt-bridge/docs/screenshots/01-login.png) |

</div>

---

## 📚 Documentation

### Getting Started
- **[Installation Guide](./rehau-nea-smart-mqtt-bridge/README.md#installation)** - Detailed setup instructions
- **[Configuration](./rehau-nea-smart-mqtt-bridge/README.md#configuration-options)** - All available options
- **[2FA Setup](./rehau-nea-smart-mqtt-bridge/README.md#-breaking-changes---version-400-february-2026)** - Email configuration

### Advanced
- **[REST API](http://localhost:3000/api-docs)** - Swagger documentation (when running)
- **[OAuth2 Setup](./rehau-nea-smart-mqtt-bridge/docs/oauth2-setup.md)** - Gmail/Outlook integration
- **[Docker Guide](./rehau-nea-smart-mqtt-bridge/docs/DOCKER_GUIDE.md)** - Container deployment
- **[Changelog](./rehau-nea-smart-mqtt-bridge/docs/CHANGELOG.md)** - Version history

---

## 🏠 Home Assistant Integration

### Auto-Discovered Entities

**Climate Controls** (per zone):
```yaml
climate.rehau_living_room:
  current_temperature: 21.5
  target_temperature: 22.0
  hvac_mode: heat
  preset_mode: comfort
```

**Sensors**:
- `sensor.rehau_bridge_status` - Connection status
- `sensor.rehau_auth_status` - Authentication state
- `sensor.rehau_outside_temperature` - Outdoor temperature
- `sensor.rehau_zone_*_humidity` - Zone humidity levels

**Binary Sensors**:
- `binary_sensor.rehau_zone_*_stale` - Data freshness indicators

---

## 🛠️ Troubleshooting

### Common Issues

**Authentication Fails**
```
✓ Verify REHAU credentials
✓ Check POP3 configuration
✓ Ensure email forwarding is active
✓ Review logs with LOG_LEVEL=debug
```

**MQTT Connection Issues**
```
✓ Verify broker is running
✓ Check MQTT_HOST and MQTT_PORT
✓ Test with mosquitto_pub/sub
✓ Verify credentials if auth enabled
```

**Web UI Not Loading**
```
✓ Ensure API_ENABLED=true
✓ Check port 3000 is available
✓ Clear browser cache
✓ Review browser console errors
```

For detailed troubleshooting, see the [full documentation](./rehau-nea-smart-mqtt-bridge/README.md#-troubleshooting).

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## 📄 License

MIT License - See [LICENSE](./LICENSE) for details.

---

## 🙏 Acknowledgments

### Sponsors

This project is proudly sponsored by **[DomoDreams.it](https://domodreams.it)** - Your trusted partner for smart home solutions.

### Contributors

- **REHAU** for the NEA SMART 2.0 system
- **Home Assistant** community
- **Playwright** team for browser automation
- All contributors and users

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/manuxio/rehau-nea-smart-2-home-assistant/issues)
- **Discussions**: [GitHub Discussions](https://github.com/manuxio/rehau-nea-smart-2-home-assistant/discussions)
- **Documentation**: [Full README](./rehau-nea-smart-mqtt-bridge/README.md)

---

<div align="center">

**Made with ❤️ for the Home Assistant community**

[⬆ Back to Top](#rehau-nea-smart-20---home-assistant-integration)

</div>
