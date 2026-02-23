# Configuration

## Required Options

### REHAU Account
- **rehau_email**: Your REHAU NEA SMART account email address
- **rehau_password**: Your REHAU NEA SMART account password

### MQTT Broker
- **mqtt_host**: MQTT broker hostname (default: `core-mosquitto`)
- **mqtt_port**: MQTT broker port (default: `1883`)

## Optional Options

### MQTT Authentication
- **mqtt_user**: MQTT username (leave empty if authentication is disabled)
- **mqtt_password**: MQTT password (leave empty if authentication is disabled)

### API Configuration
- **api_port**: REST API port (default: `3000`)

### Logging
- **log_level**: Logging verbosity
  - `debug`: Detailed debugging information (includes all MQTT messages)
  - `info`: General information (default, recommended)
  - `warn`: Warnings only
  - `error`: Errors only

### Intervals (in seconds)

- **zone_reload_interval**: How often to reload zone data (default: `300` = 5 minutes)
  - Range: 30-3600 seconds
  - Lower values = more frequent updates but more API calls
  - Higher values = less frequent updates but fewer API calls

- **token_refresh_interval**: How often to refresh authentication token (default: `21600` = 6 hours)
  - Range: 1800-86400 seconds
  - Recommended: Keep default unless experiencing authentication issues

- **referentials_reload_interval**: How often to reload system referentials (default: `86400` = 24 hours)
  - Range: 3600-604800 seconds
  - Rarely needs to be changed

### Display Names
- **use_group_in_names**: Include group names in entity display names (default: `false`)
  - `false`: Display names show only zone (e.g., "Living Room")
  - `true`: Display names include group (e.g., "First Floor Living Room")
  - **Note**: Entity IDs always include group names regardless of this setting

## Examples

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

### MQTT Connection Issues
If experiencing MQTT connection problems:
1. Verify `mqtt_host` and `mqtt_port` are correct
2. Check if MQTT broker requires authentication
3. If using authentication, ensure `mqtt_user` and `mqtt_password` are set
4. Check Home Assistant MQTT integration is configured

## More Information

For complete documentation, see the [README](https://github.com/manuxio/rehau-nea-smart-2-home-assistant/blob/main/rehau-nea-smart-mqtt-bridge/README.md).
