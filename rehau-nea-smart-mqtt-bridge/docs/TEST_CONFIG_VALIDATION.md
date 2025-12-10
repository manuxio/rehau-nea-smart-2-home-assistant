# Testing Configuration Validation

This document describes how to test runtime configuration validation.

## Automated Tests

Run the complete test suite:

```bash
npm run test:config-validation
```

This executes 16 test cases covering:
- ✅ Valid configuration
- ❌ Missing email or invalid format
- ⚠️ Password too short (warning)
- ❌ MQTT/API ports out of range
- ❌ MQTT username without password
- ❌ Invalid hostname
- ✅ Valid IPv4 address
- ❌ Intervals out of range
- ⚠️ Invalid LOG_LEVEL (warning)
- ⚠️ Invalid USE_GROUP_IN_NAMES (warning)

## Manual Testing

You can test manually by changing environment variables before starting the application.

### Test 1: Valid Configuration

```bash
export REHAU_EMAIL="test@example.com"
export REHAU_PASSWORD="password123"
export MQTT_HOST="localhost"
export MQTT_PORT="1883"
export API_PORT="3000"
npm run dev
```

**Expected result**: Application starts without errors.

### Test 2: Missing Email

```bash
unset REHAU_EMAIL
export REHAU_PASSWORD="password123"
export MQTT_HOST="localhost"
export MQTT_PORT="1883"
npm run dev
```

**Expected result**: 
```
❌ Configuration validation failed
  [REHAU_EMAIL] REHAU email is required
```
Exit code: 1

### Test 3: Invalid Email Format

```bash
export REHAU_EMAIL="not-an-email"
export REHAU_PASSWORD="password123"
export MQTT_HOST="localhost"
export MQTT_PORT="1883"
npm run dev
```

**Expected result**: Validation error for invalid email format.

### Test 4: Password Too Short (Warning)

```bash
export REHAU_EMAIL="test@example.com"
export REHAU_PASSWORD="short"
export MQTT_HOST="localhost"
export MQTT_PORT="1883"
npm run dev
```

**Expected result**: Warning but application continues:
```
⚠️  Configuration warnings
  [REHAU_PASSWORD] REHAU password is less than 8 characters (security warning)
```

### Test 5: MQTT Port Out of Range

```bash
export REHAU_EMAIL="test@example.com"
export REHAU_PASSWORD="password123"
export MQTT_HOST="localhost"
export MQTT_PORT="70000"
npm run dev
```

**Expected result**: Error for port out of range (1-65535).

### Test 6: API Port Too Low

```bash
export REHAU_EMAIL="test@example.com"
export REHAU_PASSWORD="password123"
export MQTT_HOST="localhost"
export MQTT_PORT="1883"
export API_PORT="80"
npm run dev
```

**Expected result**: Error for port < 1024 (requires root privileges).

### Test 7: MQTT Username Without Password

```bash
export REHAU_EMAIL="test@example.com"
export REHAU_PASSWORD="password123"
export MQTT_HOST="localhost"
export MQTT_PORT="1883"
export MQTT_USER="mqttuser"
# MQTT_PASSWORD not set
npm run dev
```

**Expected result**: Error because password is required when username is present.

### Test 8: Invalid Hostname

```bash
export REHAU_EMAIL="test@example.com"
export REHAU_PASSWORD="password123"
export MQTT_HOST="invalid..hostname"
export MQTT_PORT="1883"
npm run dev
```

**Expected result**: Error for invalid hostname format.

### Test 9: Interval Out of Range

```bash
export REHAU_EMAIL="test@example.com"
export REHAU_PASSWORD="password123"
export MQTT_HOST="localhost"
export MQTT_PORT="1883"
export ZONE_RELOAD_INTERVAL="10"  # Minimum is 30
npm run dev
```

**Expected result**: Error for interval out of range.

### Test 10: Invalid LOG_LEVEL (Warning)

```bash
export REHAU_EMAIL="test@example.com"
export REHAU_PASSWORD="password123"
export MQTT_HOST="localhost"
export MQTT_PORT="1883"
export LOG_LEVEL="invalid_level"
npm run dev
```

**Expected result**: Warning but application continues with default 'info'.

## Testing with Docker

If you're using Docker, you can test by passing environment variables:

```bash
docker run -e REHAU_EMAIL="test@example.com" \
           -e REHAU_PASSWORD="password123" \
           -e MQTT_HOST="localhost" \
           -e MQTT_PORT="70000" \
           your-image
```

## Testing with Home Assistant Add-on

To test as a Home Assistant add-on, modify `/data/options.json`:

```json
{
  "rehau_email": "",
  "rehau_password": "password123",
  "mqtt_host": "localhost",
  "mqtt_port": 1883
}
```

Then restart the add-on and check logs for validation errors.

## Expected Output

When validation fails, you'll see formatted output like:

```
═══════════════════════════════════════════════════════════════
❌ Configuration validation failed
═══════════════════════════════════════════════════════════════
  [REHAU_EMAIL] REHAU email is required
  [MQTT_PORT] MQTT port must be between 1 and 65535 (got: 70000)
═══════════════════════════════════════════════════════════════
```

When there are only warnings:

```
═══════════════════════════════════════════════════════════════
⚠️  Configuration warnings
═══════════════════════════════════════════════════════════════
  [REHAU_PASSWORD] REHAU password is less than 8 characters (security warning)
═══════════════════════════════════════════════════════════════
```

## Notes

- Default values are logged when used
- Critical errors cause exit(1) and prevent startup
- Warnings don't block startup but indicate non-recommended configurations
- Validation occurs BEFORE initialization of any component

## Related Documentation

- [Configuration Reference](../DOCS.md) - Complete configuration options
- [Troubleshooting Guide](TROUBLESHOOTING.md) - Common issues and solutions
