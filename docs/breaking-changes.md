# Breaking Changes - Version 2.3.3

## 🚨 CRITICAL: Version 2.3.3 REQUIRES CLEAN REINSTALL

This version fixes a critical zone mapping bug but requires complete removal and reinstallation.
**YOU MUST DELETE ALL EXISTING REHAU ENTITIES BEFORE UPGRADING.**
See [Migration Guide](./migration.md) for detailed steps.

## What's Fixed

**Critical Bug:** Zones with duplicate numbers across different controllers were overwriting each other's data.

**Example Problem:**
- Controller 0, Zone 0 → "Living Room" (temperature: 20°C)
- Controller 1, Zone 0 → "Bedroom" (temperature: 18°C)
- **BUG:** Both zones shared the same MQTT topic, causing temperature readings to alternate

**Solution:** Each zone now uses its unique MongoDB ObjectId for identification.

## MQTT Topic Changes

| Version | Topic Format | Example |
|---------|-------------|----------|
| **< 2.3.3** | `homeassistant/climate/rehau_{installId}_zone_{zoneNumber}/...` | `homeassistant/climate/rehau_6ba02d11..._zone_0/current_temperature` |
| **≥ 2.3.3** | `homeassistant/climate/rehau_{zoneId}/...` | `homeassistant/climate/rehau_6595d1d5cceecee9ce9772e1/current_temperature` |

**Impact:** All MQTT topics have changed. Old entities will become unavailable.

## Next Steps

1. Review the [Migration Guide](./migration.md) for step-by-step instructions
2. Backup your automations and scripts that reference REHAU entities
3. Follow the migration steps carefully to avoid data loss
