# Future Enhancements

Based on the REHAU NEA SMART protocol analysis, the following features are planned for future releases.

## 🎯 Planned Features

### 1. Schedule/Program Support (High Priority)

- **Auto Mode Integration**: Support for `AUTO_NORMAL_3` and `AUTO_REDUCED_4` modes
- **Schedule Display**: Show active schedule/program in Home Assistant
- **Schedule Override**: Temporary manual override with automatic return to schedule
- **Implementation Status**: 🔴 Not Started
- **Complexity**: High (requires understanding REHAU schedule format)

### 2. Party Mode (Medium Priority)

- **Local Party Mode**: `PARTY_LOCAL_6` - Override for single zone
- **Global Party Mode**: `PARTY_GLOBAL_7` - Override for entire installation
- **Duration Control**: Set party mode duration
- **Auto Return**: Automatic return to normal mode after duration
- **Implementation Status**: 🔴 Not Started
- **Complexity**: Medium (mode constants already documented)

### 3. Advanced Mode Support (Medium Priority)

- **Manual Mode**: `MANUAL_5` - Full manual control
- **Global Absence**: `GLOBAL_ABSENCE_9` - Entire installation away mode
- **Global Reduced**: `GLOBAL_REDUCED_10` - Entire installation reduced mode
- **Holiday Mode**: `STANDBY_HOLIDAY_11` - Vacation/holiday mode with frost protection
- **Implementation Status**: 🔴 Not Started
- **Complexity**: Medium

### 4. Enhanced Setpoint Management (Low Priority)

- **Standby Setpoint Display**: Show `setpoint_h_standby` (frost protection) as read-only
- **Setpoint History**: Track setpoint changes over time
- **Setpoint Validation**: Prevent invalid setpoint values
- **Implementation Status**: 🔴 Not Started
- **Complexity**: Low

### 5. System Mode Detection (Low Priority)

- **Operating Mode Display**: Show if system is in `HEATING_ONLY`, `COOLING_ONLY`, or `AUTO` mode
- **Mode Constraints**: Prevent invalid mode combinations
- **Mode Recommendations**: Suggest optimal mode based on season/temperature
- **Implementation Status**: 🔴 Not Started
- **Complexity**: Low

## 📋 Technical Reference

The add-on now correctly handles:
- ✅ **Setpoint Selection**: Automatically selects correct setpoint (`setpoint_h_normal`, `setpoint_h_reduced`, `setpoint_c_normal`, `setpoint_c_reduced`) based on mode and preset
- ✅ **OFF Mode Handling**: Publishes "None" for temperature and preset when zone is off
- ✅ **Multi-Controller Support**: Correctly routes commands to zones on different controllers
- ✅ **Mode Constants**: Uses REHAU protocol mode values (0=Comfort, 1=Away, 2=Standby, etc.)
- ✅ **Read/Write Separation**: Correctly implements REHAU's setpoint architecture

## Understanding REHAU Setpoints

**CRITICAL: Read vs Write Setpoints**

REHAU uses separate fields for reading and writing temperatures:

| Field | Direction | Purpose |
|-------|-----------|---------|
| `setpoint_used` | **READ-ONLY** | What temperature the thermostat is actually targeting RIGHT NOW |
| `setpoint_h_normal` | **WRITE-ONLY** | Configuration for heating comfort temperature |
| `setpoint_h_reduced` | **WRITE-ONLY** | Configuration for heating away temperature |
| `setpoint_c_normal` | **WRITE-ONLY** | Configuration for cooling comfort temperature |
| `setpoint_c_reduced` | **WRITE-ONLY** | Configuration for cooling away temperature |

**Why this separation?**

- **`setpoint_used`** shows the **actual** temperature the controller is targeting RIGHT NOW
  - Reflects intelligent decisions (programs, optimization, schedules)
  - May differ from configured setpoints due to active schedules or system optimization
  - This is what users see in Home Assistant

- **`setpoint_h_normal`, `setpoint_h_reduced`, etc.** are configuration values
  - Tell the system what temperatures to use in different modes
  - The controller decides WHEN to use each one based on current mode and schedules
  - Updated when users change temperature in Home Assistant

**Benefits:**
1. Controller can make intelligent decisions (programs, optimization)
2. App displays actual system behavior (via `setpoint_used`)
3. Users see what's really happening, not just what they configured
4. Supports complex features like schedules without app needing to know details

**Example:**
```
User configures:
- Heating Comfort: 22°C (setpoint_h_normal)
- Heating Away: 19°C (setpoint_h_reduced)

Active schedule switches to Away mode at 8 AM:
- setpoint_used changes to 19°C
- Home Assistant displays: Target = 19°C (actual behavior)
- Configuration values remain unchanged
```

For detailed technical information about REHAU modes and setpoints, see the internal documentation.

## 🤝 Contributing

Interested in implementing these features? Contributions are welcome!

1. Check the [GitHub Issues](https://github.com/manuxio/rehau-nea-smart-2-home-assistant/issues) for related discussions
2. Review the REHAU protocol documentation (stored in project memory)
3. Submit a pull request with your implementation

**Priority Order for Implementation:**
1. Schedule/Program support (most requested)
2. Party mode (useful for events)
3. Advanced modes (nice-to-have)
4. Enhanced setpoint management (polish)
5. System mode detection (informational)

## Related Documentation

- [Features Guide](./features.md) - Current features
- [Development Guide](./development.md) - Developer tools and setup
- [CHANGELOG](../rehau-nea-smart-mqtt-bridge/CHANGELOG.md) - Version history
