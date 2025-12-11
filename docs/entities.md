# Entity Naming in Home Assistant

This document explains how entities are named and structured in Home Assistant.

## Climate Entities

| Zone Name | Entity ID | MQTT Topic |
|-----------|-----------|------------|
| Living Room | `climate.rehau_xxx_ground_floor_living_room` | `homeassistant/climate/rehau_6595d1d5cceecee9ce9772e1/...` |
| Kitchen | `climate.rehau_xxx_ground_floor_kitchen` | `homeassistant/climate/rehau_6595d1d71cf174839175074b/...` |
| Bedroom 1 | `climate.rehau_xxx_first_floor_bedroom_1` | `homeassistant/climate/rehau_6591e16c9645c4cf338302/...` |

## Temperature Sensors

| Zone Name | Entity ID | MQTT Topic |
|-----------|-----------|------------|
| Living Room Temperature | `sensor.rehau_ground_floor_living_room_temperature` | `homeassistant/sensor/rehau_6595d1d5cceecee9ce9772e1_temperature/state` |
| Living Room Humidity | `sensor.rehau_ground_floor_living_room_humidity` | `homeassistant/sensor/rehau_6595d1d5cceecee9ce9772e1_humidity/state` |
| Living Room Demanding | `binary_sensor.rehau_ground_floor_living_room_demanding` | `homeassistant/binary_sensor/rehau_6595d1d5cceecee9ce9772e1_demanding/state` |
| Living Room Demanding Percent | `sensor.rehau_ground_floor_living_room_demanding_percent` | `homeassistant/sensor/rehau_6595d1d5cceecee9ce9772e1_demanding_percent/state` |
| Living Room Dewpoint | `sensor.rehau_ground_floor_living_room_dewpoint` | `homeassistant/sensor/rehau_6595d1d5cceecee9ce9772e1_dewpoint/state` |

## Control Entities

| Entity Type | Entity ID | MQTT Topic |
|-------------|-----------|------------|
| Ring Light | `light.rehau_xxx_ground_floor_living_room_ring_light` | `homeassistant/light/rehau_6595d1d5cceecee9ce9772e1_ring_light/...` |
| Lock | `lock.rehau_xxx_ground_floor_living_room_lock` | `homeassistant/lock/rehau_6595d1d5cceecee9ce9772e1_lock/...` |

## Entity ID Structure

```
climate.rehau_{installation}_{group}_{zone}
sensor.rehau_{group}_{zone}_{type}
light.rehau_{installation}_{group}_{zone}_ring_light
lock.rehau_{installation}_{group}_{zone}_lock
```

**Notes:**
- `{installation}` = Sanitized installation name (lowercase, underscores)
- `{group}` = Sanitized group name (lowercase, underscores)
- `{zone}` = Sanitized zone name (lowercase, underscores)
- `{type}` = `temperature`, `humidity`, `demanding_percent`, or `dewpoint`
- Binary sensor entities (`demanding`) follow the same naming scheme but use the `binary_sensor` domain.

## MQTT Topic Structure (v2.3.3+)

```
# Climate entity
homeassistant/climate/rehau_{zoneId}/
  ├─ config                    # Discovery config
  ├─ availability              # Online/offline status
  ├─ current_temperature       # Current temp reading
  ├─ target_temperature        # Target setpoint
  ├─ current_humidity          # Humidity reading
  ├─ mode                      # off/heat/cool
  ├─ mode_command              # Command topic
  ├─ preset                    # comfort/away
  └─ preset_command            # Command topic

# Separate sensors
homeassistant/sensor/rehau_{zoneId}_temperature/
  ├─ config
  ├─ state
  └─ availability

homeassistant/sensor/rehau_{zoneId}_humidity/
  ├─ config
  ├─ state
  └─ availability

homeassistant/binary_sensor/rehau_{zoneId}_demanding/
  ├─ config
  ├─ state
  └─ availability

homeassistant/sensor/rehau_{zoneId}_demanding_percent/
  ├─ config
  ├─ state
  └─ availability

homeassistant/sensor/rehau_{zoneId}_dewpoint/
  ├─ config
  ├─ state
  └─ availability

# Ring light
homeassistant/light/rehau_{zoneId}_ring_light/
  ├─ config
  ├─ state
  └─ command

# Lock
homeassistant/lock/rehau_{zoneId}_lock/
  ├─ config
  ├─ state
  └─ command
```

**Key Change:** Topics now use `{zoneId}` (MongoDB ObjectId) instead of `{installId}_zone_{zoneNumber}`

> ℹ️ **Demanding sensor confidence**: The `demanding`, `demanding_percent`, and `dewpoint` entities are sourced from REHAU's `status_cc_zone.demand_state`, `demand`, and `dewpoint` fields. Early testing indicates `demanding` aligns with the manifold LEDs, but real-world confirmation is still in progress.

## Version 2.3.3 Changes

Starting with version 2.3.3, entity IDs and MQTT topics use unique zone IDs (MongoDB ObjectIds) instead of zone numbers. This fixes a critical bug where zones with duplicate numbers across different controllers were overwriting each other's data.

**Before v2.3.3:**
- Topic format: `homeassistant/climate/rehau_{installId}_zone_{zoneNumber}/...`
- Problem: Multiple zones with the same number would conflict

**After v2.3.3:**
- Topic format: `homeassistant/climate/rehau_{zoneId}/...`
- Solution: Each zone uses its unique MongoDB ObjectId

If you're upgrading from a version before 2.3.3, see the [Migration Guide](./migration.md) for instructions on updating your entities.

## Related Documentation

- [Migration Guide](./migration.md) - How to migrate from older versions
- [Breaking Changes](./breaking-changes.md) - Details about version 2.3.3 changes
- [Features Guide](./features.md) - What entities are available
