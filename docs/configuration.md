# Configuration Guide

This guide covers configuration for both Home Assistant OS (Add-on) and Home Assistant Core (Docker).

## Home Assistant OS Add-on Configuration

Configure via the add-on's **Configuration** tab in Home Assistant:

### Required Settings

```yaml
rehau:
  email: your.email@example.com
  password: your_password
mqtt:
  host: core-mosquitto  # Use service name if Mosquitto add-on, or broker hostname/IP
  port: 1883
  username: mqtt_user
  password: mqtt_password
```

### Optional Settings

```yaml
api_port: 3000                          # REST API port (default: 3000)
log_level: info                         # debug|info|warn|error (default: info)
zone_reload_interval: 300               # Seconds between HTTPS polls (default: 300, max: 86400)
token_refresh_interval: 21600           # Seconds between token refresh (default: 21600)
referentials_reload_interval: 86400     # Seconds between referentials reload (default: 86400)
use_group_in_names: false               # Include group in display names (default: false)
```

---

## Home Assistant Core Configuration

Configure via environment variables (see `.env.example` for template):

### Required Environment Variables

```bash
REHAU_EMAIL=your.email@example.com
REHAU_PASSWORD=your_password
MQTT_HOST=localhost  # or your MQTT broker hostname/IP
MQTT_PORT=1883
```

### Optional Environment Variables

```bash
API_PORT=3000
LOG_LEVEL=info
ZONE_RELOAD_INTERVAL=300
TOKEN_REFRESH_INTERVAL=21600
REFERENTIALS_RELOAD_INTERVAL=86400
USE_GROUP_IN_NAMES=false
```

---

## Configuration Parameters Explained

### REHAU Credentials

- **REHAU_EMAIL / rehau_email**: Your REHAU NEA SMART account email address
- **REHAU_PASSWORD / rehau_password**: Your REHAU NEA SMART account password

### MQTT Configuration

- **MQTT_HOST / mqtt_host**: 
  - HA OS: Usually `core-mosquitto` if using the Mosquitto add-on
  - HA Core: Use broker hostname/IP (e.g., `localhost`, `192.168.1.100`, or Docker service name)
- **MQTT_PORT / mqtt_port**: Usually `1883` for non-TLS connections
- **MQTT_USER / mqtt_user**: Required if MQTT broker has authentication enabled
- **MQTT_PASSWORD / mqtt_password**: Required if MQTT broker has authentication enabled

### API Configuration

- **API_PORT / api_port**: Port for the REST API health endpoint (default: `3000`)

### Logging

- **LOG_LEVEL / log_level**: Logging verbosity level
  - `debug`: Detailed logging including MQTT messages and API requests (use with caution)
  - `info`: Standard logging (recommended for production)
  - `warn`: Only warnings and errors
  - `error`: Only errors

### Interval Configuration

- **ZONE_RELOAD_INTERVAL / zone_reload_interval**: How often to poll REHAU API for zone updates (in seconds)
  - Lower values = more frequent updates but more API calls
  - Default: `300` (5 minutes)
  - Maximum: `86400` (24 hours)
  
- **TOKEN_REFRESH_INTERVAL / token_refresh_interval**: How often to refresh the authentication token (in seconds)
  - Default: `21600` (6 hours)
  
- **REFERENTIALS_RELOAD_INTERVAL / referentials_reload_interval**: How often to reload referential data (in seconds)
  - Default: `86400` (24 hours)
  
- **LIVE_DATA_INTERVAL / live_data_interval**: How often to poll for live sensor data (in seconds)
  - Default: `300` (5 minutes)

### Display Configuration

- **USE_GROUP_IN_NAMES / use_group_in_names**: Include group name in entity display names
  - `false`: Entity names will be shorter (e.g., "Living Room")
  - `true`: Entity names will include group (e.g., "Ground Floor - Living Room")
  - Default: `false`

### Command Retry Configuration

- **COMMAND_RETRY_TIMEOUT / command_retry_timeout**: Timeout for command retries (in seconds)
  - Default: `30`
  
- **COMMAND_MAX_RETRIES / command_max_retries**: Maximum number of retry attempts for failed commands
  - Default: `3`

---

## Configuration Best Practices

1. **Start with defaults**: Most users don't need to change the optional settings
2. **Adjust intervals carefully**: Lower intervals increase API usage and may hit rate limits
3. **Use debug mode sparingly**: Debug logging can be verbose and may expose sensitive information
4. **Secure your credentials**: Never commit `.env` files or configuration with credentials to version control

---

## Related Documentation

- [Installation Guide](./installation.md) - How to install the bridge
- [Troubleshooting Guide](./troubleshooting.md) - Common configuration issues
- [Features Guide](./features.md) - What features are available
