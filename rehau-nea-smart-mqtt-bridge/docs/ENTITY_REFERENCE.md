# Entity Reference

Complete reference for entity naming conventions and MQTT topic structure in Home Assistant.

## Table of Contents

- [Entity Types](#entity-types)
- [Entity ID Structure](#entity-id-structure)
- [MQTT Topic Structure](#mqtt-topic-structure)
- [Display Names](#display-names)
- [Examples](#examples)

---

## Entity Types

The bridge creates the following entity types for each zone:

### Climate Entities

Climate entities provide full thermostat control for each heating zone.

| Zone Name | Entity ID | MQTT Topic |
|-----------|-----------|------------|
| Living Room | `climate.rehau_xxx_ground_floor_living_room` | `homeassistant/climate/rehau_6595d1d5cceecee9ce9772e1/...` |
| Kitchen | `climate.rehau_xxx_ground_floor_kitchen` | `homeassistant/climate/rehau_6595d1d71cf174839175074b/...` |
| Bedroom 1 | `climate.rehau_xxx_first_floor_bedroom_1` | `homeassistant/climate/rehau_6595d1e16c9645c4cf338302/...` |

**Features:**
- Current temperature reading
- Target temperature (setpoint) control
- Mode control (off/heat/cool)
- Preset control (comfort/away)
- Humidity reading

### Temperature Sensors

Separate sensor entities for detailed monitoring.

| Zone Name | Entity ID | MQTT Topic |
|-----------|-----------|------------|
| Living Room Temperature | `sensor.rehau_ground_floor_living_room_temperature` | `homeassistant/sensor/rehau_6595d1d5cceecee9ce9772e1_temperature/state` |
| Living Room Humidity | `sensor.rehau_ground_floor_living_room_humidity` | `homeassistant/sensor/rehau_6595d1d5cceecee9ce9772e1_humidity/state` |
| Living Room Demanding | `binary_sensor.rehau_ground_floor_living_room_demanding` | `homeassistant/binary_sensor/rehau_6595d1d5cceecee9ce9772e1_demanding/state` |
| Living Room Demanding Percent | `sensor.rehau_ground_floor_living_room_demanding_percent` | `homeassistant/sensor/rehau_6595d1d5cceecee9ce9772e1_demanding_percent/state` |
| Living Room Dewpoint | `sensor.rehau_ground_floor_living_room_dewpoint` | `homeassistant/sensor/rehau_6595d1d5cceecee9ce9772e1_dewpoint/state` |

**Sensor Types:**
- **Temperature**: Current zone temperature
- **Humidity**: Current zone humidity percentage
- **Demanding** (binary): Whether zone is demanding heat/cool
- **Demanding Percent**: Percentage of demand (0-100)
- **Dewpoint**: Calculated dewpoint temperature

> **Note**: The `demanding`, `demanding_percent`, and `dewpoint` entities are sourced from REHAU's `status_cc_zone.demand_state`, `demand`, and `dewpoint` fields. Early testing indicates `demanding` aligns with the manifold LEDs, but real-world confirmation is still in progress.

### Control Entities

Additional control entities for zone features.

| Entity Type | Entity ID | MQTT Topic |
|-------------|-----------|------------|
| Ring Light | `light.rehau_xxx_ground_floor_living_room_ring_light` | `homeassistant/light/rehau_6595d1d5cceecee9ce9772e1_ring_light/...` |
| Lock | `lock.rehau_xxx_ground_floor_living_room_lock` | `homeassistant/lock/rehau_6595d1d5cceecee9ce9772e1_lock/...` |

**Control Features:**
- **Ring Light**: Control the zone's ring light indicator
- **Lock**: Lock/unlock zone controls

---

## Entity ID Structure

Entity IDs follow a consistent naming pattern:

```
climate.rehau_{installation}_{group}_{zone}
sensor.rehau_{group}_{zone}_{type}
light.rehau_{installation}_{group}_{zone}_ring_light
lock.rehau_{installation}_{group}_{zone}_lock
```

### Components

- **`{installation}`**: Sanitized installation name (lowercase, spaces replaced with underscores)
- **`{group}`**: Sanitized group name (lowercase, spaces replaced with underscores)
- **`{zone}`**: Sanitized zone name (lowercase, spaces replaced with underscores)
- **`{type}`**: Sensor type (`temperature`, `humidity`, `demanding_percent`, or `dewpoint`)

### Sanitization Rules

- All text converted to lowercase
- Spaces replaced with underscores
- Special characters removed or replaced
- Entity IDs always include group names regardless of `use_group_in_names` setting

### Examples

**Installation**: "My House"
**Group**: "Ground Floor"
**Zone**: "Living Room"

Results in:
- `climate.rehau_my_house_ground_floor_living_room`
- `sensor.rehau_ground_floor_living_room_temperature`
- `light.rehau_my_house_ground_floor_living_room_ring_light`

---

## MQTT Topic Structure

MQTT topics use zone IDs (MongoDB ObjectIds) for unique identification (v2.3.3+).

### Climate Entity Topics

```
homeassistant/climate/rehau_{zoneId}/
  ├─ config                    # Discovery configuration
  ├─ availability              # Online/offline status
  ├─ current_temperature       # Current temperature reading
  ├─ target_temperature        # Target setpoint
  ├─ current_humidity          # Humidity reading
  ├─ mode                      # Current mode (off/heat/cool)
  ├─ mode_command              # Mode command topic
  ├─ preset                    # Current preset (comfort/away)
  └─ preset_command            # Preset command topic
```

### Sensor Entity Topics

```
homeassistant/sensor/rehau_{zoneId}_temperature/
  ├─ config                    # Discovery configuration
  ├─ state                     # Temperature value
  └─ availability              # Online/offline status

homeassistant/sensor/rehau_{zoneId}_humidity/
  ├─ config
  ├─ state
  └─ availability

homeassistant/binary_sensor/rehau_{zoneId}_demanding/
  ├─ config
  ├─ state                     # ON/OFF
  └─ availability

homeassistant/sensor/rehau_{zoneId}_demanding_percent/
  ├─ config
  ├─ state                     # 0-100
  └─ availability

homeassistant/sensor/rehau_{zoneId}_dewpoint/
  ├─ config
  ├─ state                     # Temperature value
  └─ availability
```

### Control Entity Topics

```
homeassistant/light/rehau_{zoneId}_ring_light/
  ├─ config                    # Discovery configuration
  ├─ state                     # ON/OFF
  └─ command                   # Command topic

homeassistant/lock/rehau_{zoneId}_lock/
  ├─ config                    # Discovery configuration
  ├─ state                     # LOCKED/UNLOCKED
  └─ command                   # Command topic
```

### Topic Format Change (v2.3.3+)

**Before v2.3.3:**
- Topics used: `homeassistant/climate/rehau_{installId}_zone_{zoneNumber}/...`
- Problem: Zones with duplicate numbers across controllers overwrote each other

**After v2.3.3:**
- Topics use: `homeassistant/climate/rehau_{zoneId}/...`
- Solution: Each zone uses unique MongoDB ObjectId for identification
- Example: `homeassistant/climate/rehau_6595d1d5cceecee9ce9772e1/...`

---

## Display Names

Display names can be configured via the `use_group_in_names` option.

### Configuration

```yaml
use_group_in_names: false  # Default
```

### Behavior

**`use_group_in_names: false`** (default):
- Display names show only zone name
- Example: "Living Room"
- Entity IDs still include group names

**`use_group_in_names: true`**:
- Display names include group name
- Example: "First Floor Living Room"
- Entity IDs unchanged

### Examples

**Zone**: "Living Room"
**Group**: "Ground Floor"
**Installation**: "My House"

| Setting | Display Name | Entity ID |
|---------|--------------|-----------|
| `false` | "Living Room" | `climate.rehau_my_house_ground_floor_living_room` |
| `true` | "Ground Floor Living Room" | `climate.rehau_my_house_ground_floor_living_room` |

**Note**: Entity IDs always include group names regardless of this setting.

---

## Examples

### Complete Zone Example

**Installation**: "Villa Rossi"
**Group**: "Piano Terra" (Ground Floor)
**Zone**: "Salotto" (Living Room)
**Zone ID**: `6595d1d5cceecee9ce9772e1`

**Entities Created:**

1. **Climate Entity**
   - Entity ID: `climate.rehau_villa_rossi_piano_terra_salotto`
   - Display Name: "Salotto" (or "Piano Terra Salotto" if `use_group_in_names: true`)
   - MQTT Topic: `homeassistant/climate/rehau_6595d1d5cceecee9ce9772e1/`

2. **Temperature Sensor**
   - Entity ID: `sensor.rehau_piano_terra_salotto_temperature`
   - MQTT Topic: `homeassistant/sensor/rehau_6595d1d5cceecee9ce9772e1_temperature/`

3. **Humidity Sensor**
   - Entity ID: `sensor.rehau_piano_terra_salotto_humidity`
   - MQTT Topic: `homeassistant/sensor/rehau_6595d1d5cceecee9ce9772e1_humidity/`

4. **Demanding Binary Sensor**
   - Entity ID: `binary_sensor.rehau_piano_terra_salotto_demanding`
   - MQTT Topic: `homeassistant/binary_sensor/rehau_6595d1d5cceecee9ce9772e1_demanding/`

5. **Demanding Percent Sensor**
   - Entity ID: `sensor.rehau_piano_terra_salotto_demanding_percent`
   - MQTT Topic: `homeassistant/sensor/rehau_6595d1d5cceecee9ce9772e1_demanding_percent/`

6. **Dewpoint Sensor**
   - Entity ID: `sensor.rehau_piano_terra_salotto_dewpoint`
   - MQTT Topic: `homeassistant/sensor/rehau_6595d1d5cceecee9ce9772e1_dewpoint/`

7. **Ring Light**
   - Entity ID: `light.rehau_villa_rossi_piano_terra_salotto_ring_light`
   - MQTT Topic: `homeassistant/light/rehau_6595d1d5cceecee9ce9772e1_ring_light/`

8. **Lock**
   - Entity ID: `lock.rehau_villa_rossi_piano_terra_salotto_lock`
   - MQTT Topic: `homeassistant/lock/rehau_6595d1d5cceecee9ce9772e1_lock/`

---

## Related Documentation

- [Configuration Reference](../DOCS.md) - Configuration options including `use_group_in_names`
- [Installation Guide](INSTALLATION.md) - Installation instructions
- [Troubleshooting Guide](TROUBLESHOOTING.md) - Common issues with entities

