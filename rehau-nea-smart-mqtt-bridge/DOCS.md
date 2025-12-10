# Configuration Reference

Complete reference for configuring the REHAU NEA SMART 2.0 MQTT Bridge.

## Table of Contents

- [Required Options](#required-options)
- [Optional Options](#optional-options)
- [Configuration Examples](#configuration-examples)
- [Validation Rules](#validation-rules)
- [Troubleshooting](#troubleshooting)

---

## Required Options

These options must be configured for the bridge to function.

### REHAU Account

- **rehau_email**: Your REHAU NEA SMART account email address
  - Must be a valid email format
  - Example: `"your@email.com"`

- **rehau_password**: Your REHAU NEA SMART account password
  - Minimum 8 characters recommended (warning if shorter)
  - Example: `"yourpassword"`

### MQTT Broker

- **mqtt_host**: MQTT broker hostname or IP address
  - Default: `core-mosquitto` (for Home Assistant OS)
  - For Docker: Use service name or IP address
  - For standalone: Use `localhost` or broker IP
  - Must be a valid hostname or IPv4 address
  - Example: `"core-mosquitto"`, `"192.168.1.100"`, or `"mqtt-broker"`

- **mqtt_port**: MQTT broker port
  - Default: `1883`
  - Range: 1-65535
  - Example: `1883`

---

## Optional Options

### MQTT Authentication

- **mqtt_user**: MQTT username
  - Leave empty if authentication is disabled
  - If set, `mqtt_password` is required
  - Example: `"homeassistant"`

- **mqtt_password**: MQTT password
  - Required if `mqtt_user` is set
  - Leave empty if authentication is disabled
  - Example: `"mqttpassword"`

### API Configuration

- **api_port**: REST API port
  - Default: `3000`
  - Range: 1024-65535 (ports < 1024 require root privileges)
  - Example: `3000`

### Logging

- **log_level**: Logging verbosity level
  - Default: `info`
  - Options:
    - `debug`: Detailed debugging information (includes all MQTT messages)
    - `info`: General information (recommended for production)
    - `warn`: Warnings only
    - `error`: Errors only
  - Example: `"info"`

### Update Intervals (in seconds)

These control how often the bridge polls the REHAU API and refreshes data.

- **zone_reload_interval**: How often to reload zone data
  - Default: `300` (5 minutes)
  - Range: 30-3600 seconds
  - Lower values = more frequent updates but more API calls
  - Higher values = less frequent updates but fewer API calls
  - Example: `300`

- **token_refresh_interval**: How often to refresh authentication token
  - Default: `21600` (6 hours)
  - Range: 1800-86400 seconds (30 minutes to 24 hours)
  - Recommended: Keep default unless experiencing authentication issues
  - Example: `21600`

- **referentials_reload_interval**: How often to reload system referentials
  - Default: `86400` (24 hours)
  - Range: 3600-604800 seconds (1 hour to 7 days)
  - Rarely needs to be changed
  - Example: `86400`

### Display Configuration

- **use_group_in_names**: Include group names in entity display names
  - Default: `false`
  - Options:
    - `false`: Display names show only zone (e.g., "Living Room")
    - `true`: Display names include group (e.g., "First Floor Living Room")
  - **Note**: Entity IDs always include group names regardless of this setting
  - Example: `false`

---

## Configuration Examples

### Basic Configuration (Mosquitto without authentication)

```yaml
rehau_email: "your@email.com"
rehau_password: "yourpassword"
mqtt_host: "core-mosquitto"
mqtt_port: 1883
log_level: "info"
```

### With MQTT Authentication

```yaml
rehau_email: "your@email.com"
rehau_password: "yourpassword"
mqtt_host: "core-mosquitto"
mqtt_port: 1883
mqtt_user: "homeassistant"
mqtt_password: "mqttpassword"
log_level: "info"
```

### Custom Intervals

```yaml
rehau_email: "your@email.com"
rehau_password: "yourpassword"
mqtt_host: "core-mosquitto"
mqtt_port: 1883
log_level: "info"
zone_reload_interval: 600
token_refresh_interval: 43200
use_group_in_names: true
```

### Docker Environment Variables

```bash
REHAU_EMAIL=your@email.com
REHAU_PASSWORD=yourpassword
MQTT_HOST=mqtt-broker
MQTT_PORT=1883
MQTT_USER=homeassistant
MQTT_PASSWORD=mqttpassword
API_PORT=3000
LOG_LEVEL=info
ZONE_RELOAD_INTERVAL=300
TOKEN_REFRESH_INTERVAL=21600
REFERENTIALS_RELOAD_INTERVAL=86400
USE_GROUP_IN_NAMES=false
```

---

## Validation Rules

The bridge validates all configuration options at startup. Invalid configurations will prevent the bridge from starting.

### Critical Errors (Prevent Startup)

- Missing `rehau_email`
- Invalid email format
- Missing `mqtt_host`
- Invalid hostname format
- MQTT port out of range (1-65535)
- API port < 1024 or > 65535
- MQTT username set without password
- Intervals out of allowed ranges

### Warnings (Allow Startup)

- Password less than 8 characters
- Invalid `log_level` value (defaults to `info`)
- Invalid `use_group_in_names` value (defaults to `false`)

For detailed testing information, see [Configuration Validation Testing](docs/TEST_CONFIG_VALIDATION.md).

---

## Troubleshooting

### Enable Debug Logging

Set `log_level: "debug"` to see detailed information including:
- Full MQTT messages
- HTTP requests and responses
- Authentication tokens (partially redacted)
- Installation details

**⚠️ Warning**: Debug mode logs sensitive information. Review logs before sharing publicly.

### Adjust Update Frequency

If entities are not updating frequently enough, lower the `zone_reload_interval`:

```yaml
zone_reload_interval: 120  # Update every 2 minutes
```

**Note**: Lower intervals increase API calls to REHAU servers. Use reasonable values (minimum 30 seconds).

### MQTT Connection Issues

If experiencing MQTT connection problems:

1. Verify `mqtt_host` and `mqtt_port` are correct
2. Check if MQTT broker requires authentication
3. If using authentication, ensure both `mqtt_user` and `mqtt_password` are set
4. Check Home Assistant MQTT integration is configured
5. Verify network connectivity between bridge and broker

### Configuration Validation Errors

If you see validation errors at startup:

1. Check the error message for the specific field causing issues
2. Review [Validation Rules](#validation-rules) above
3. See [Configuration Validation Testing](docs/TEST_CONFIG_VALIDATION.md) for examples
4. Verify all required fields are present
5. Check value ranges and formats

---

## Related Documentation

- [Installation Guide](docs/INSTALLATION.md) - Installation instructions
- [Configuration Validation Testing](docs/TEST_CONFIG_VALIDATION.md) - Testing configuration validation
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md) - Comprehensive troubleshooting
- [Main README](../../README.md) - Project overview and quick start
