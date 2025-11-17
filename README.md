# REHAU NEA SMART 2.0 - Home Assistant Add-on

TypeScript-based MQTT bridge for REHAU NEA SMART 2.0 heating systems with Home Assistant integration.

> **⚠️ DISCLAIMER:** This is an unofficial, community-developed integration. It is **NOT affiliated with, endorsed by, or supported by REHAU AG or REHAU Industries SE & Co. KG**. REHAU® and NEA SMART® are registered trademarks of REHAU. Use this software at your own risk.

> **🚨 CRITICAL: Version 2.3.3 REQUIRES CLEAN REINSTALL**
>
> This version fixes a critical zone mapping bug but requires complete removal and reinstallation.
> **YOU MUST DELETE ALL EXISTING REHAU ENTITIES BEFORE UPGRADING.**
> See [Migration Guide](#-migration-guide-v233) below.

---

## 🚨 BREAKING CHANGES - Version 2.3.3

### What's Fixed

**Critical Bug:** Zones with duplicate numbers across different controllers were overwriting each other's data.

**Example Problem:**
- Controller 0, Zone 0 → "Living Room" (temperature: 20°C)
- Controller 1, Zone 0 → "Bedroom" (temperature: 18°C)
- **BUG:** Both zones shared the same MQTT topic, causing temperature readings to alternate

**Solution:** Each zone now uses its unique MongoDB ObjectId for identification.

### MQTT Topic Changes

| Version | Topic Format | Example |
|---------|-------------|----------|
| **< 2.3.3** | `homeassistant/climate/rehau_{installId}_zone_{zoneNumber}/...` | `homeassistant/climate/rehau_6ba02d11..._zone_0/current_temperature` |
| **≥ 2.3.3** | `homeassistant/climate/rehau_{zoneId}/...` | `homeassistant/climate/rehau_6595d1d5cceecee9ce9772e1/current_temperature` |

**Impact:** All MQTT topics have changed. Old entities will become unavailable.

---

## 📋 Migration Guide (v2.3.3)

### ⚠️ REQUIRED STEPS - DO NOT SKIP

#### Step 1: Backup Your Configuration
```bash
# Backup automations and scripts that use REHAU entities
# You'll need to update entity IDs after migration
```

#### Step 2: Uninstall Add-on
1. Go to **Settings** → **Add-ons** → **REHAU NEA SMART MQTT Bridge**
2. Click **Uninstall**
3. Wait for complete removal

#### Step 3: Remove Old Entities

**Option A: Via Home Assistant UI (Recommended)**
1. Go to **Settings** → **Devices & Services** → **MQTT**
2. Find all REHAU devices
3. Click each device → **Delete Device**
4. Repeat for all REHAU zones

**Option B: Via MQTT Explorer/CLI**
```bash
# Delete all REHAU discovery topics
mosquitto_pub -h localhost -t "homeassistant/climate/rehau_+/config" -n -r
mosquitto_pub -h localhost -t "homeassistant/sensor/rehau_+/config" -n -r
mosquitto_pub -h localhost -t "homeassistant/light/rehau_+/config" -n -r
mosquitto_pub -h localhost -t "homeassistant/lock/rehau_+/config" -n -r
```

#### Step 4: Reinstall Add-on
1. Go to **Settings** → **Add-ons** → **Add-on Store**
2. Find **REHAU NEA SMART MQTT Bridge**
3. Click **Install**
4. Configure with your REHAU credentials (see [Configuration](#-configuration) below)
5. Start the add-on

#### Step 5: Verify New Entities
1. Go to **Settings** → **Devices & Services** → **MQTT**
2. New REHAU devices should appear automatically
3. Check that all zones are present and showing correct temperatures

#### Step 6: Update Automations & Scripts
- Entity IDs have changed (see [Entity Naming](#-entity-naming-in-home-assistant) below)
- Update all references in automations, scripts, and dashboards

---

## 📦 Installation (New Users)

### Step 1: Add Repository to Home Assistant

1. Navigate to **Settings** → **Add-ons** → **Add-on Store**
2. Click the **⋮** (three dots) menu in the top right
3. Select **Repositories**
4. Add this URL:
   ```
   https://github.com/manuxio/rehau-nea-smart-2-home-assistant
   ```
5. Click **Add**

### Step 2: Install the Add-on

1. Refresh the Add-on Store page
2. Find **REHAU NEA SMART 2.0 MQTT Bridge** in the list
3. Click on it and press **Install**
4. Wait for the installation to complete

### Step 3: Configure the Add-on

See [Configuration](#-configuration) section below.

### Step 4: Start the Add-on

1. Go to the **Info** tab
2. Click **Start**
3. Enable **Start on boot** if you want it to start automatically
4. Check the **Log** tab to verify it's running correctly

---

## 📦 Installation for Home Assistant Core

This bridge can be deployed as a standalone Docker container for use with Home Assistant Core (or any Home Assistant installation that doesn't use the Supervisor).

### Prerequisites

- Docker and Docker Compose installed
- An MQTT broker running and accessible (Mosquitto, RabbitMQ, etc.)
- Home Assistant Core with MQTT integration configured

### Step 1: Set Up MQTT Broker

Ensure you have an MQTT broker running. If you don't have one, you can use Mosquitto:

```yaml
# docker-compose.yml (for MQTT broker)
services:
  mqtt-broker:
    image: eclipse-mosquitto:latest
    container_name: mosquitto
    ports:
      - "1883:1883"
    volumes:
      - ./mosquitto/config:/mosquitto/config
      - ./mosquitto/data:/mosquitto/data
      - ./mosquitto/log:/mosquitto/log
```

### Step 2: Configure Home Assistant MQTT Integration

1. In Home Assistant, go to **Settings** → **Devices & Services**
2. Click **Add Integration**
3. Search for **MQTT** and select it
4. Configure with your MQTT broker details:
   - **Broker**: Your MQTT broker hostname/IP
   - **Port**: Usually `1883`
   - **Username/Password**: If your broker requires authentication
5. Enable **Enable discovery** (should be enabled by default)
6. Click **Submit**

### Step 3: Deploy the Bridge

#### Option A: Complete Docker Compose Setup (Recommended for New Installations)

This option sets up everything together: MQTT broker, REHAU bridge, and Home Assistant Core in a single `docker-compose.yaml` file.

1. **Create your Docker Compose file** (`docker-compose.yaml`):

```yaml
version: '3.8'

services:
  # MQTT Broker (Mosquitto)
  mqtt-broker:
    container_name: mosquitto
    image: eclipse-mosquitto:latest
    ports:
      - '1883:1883'
      - '9001:9001'  # WebSocket port
    volumes:
      - ./mosquitto/config:/mosquitto/config
      - ./mosquitto/data:/mosquitto/data
      - ./mosquitto/log:/mosquitto/log
    restart: unless-stopped
    networks:
      - rehau-network
    healthcheck:
      test: ["CMD-SHELL", "pgrep mosquitto || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

  # REHAU NEA SMART MQTT Bridge
  rehau-bridge:
    build:
      context: ./rehau-nea-smart-mqtt-bridge
      dockerfile: Dockerfile
    container_name: rehau-nea-smart-mqtt-bridge
    restart: unless-stopped
    environment:
      # REHAU Credentials (Required)
      - REHAU_EMAIL=${REHAU_EMAIL}
      - REHAU_PASSWORD=${REHAU_PASSWORD}
      
      # MQTT Configuration (Required)
      - MQTT_HOST=mqtt-broker  # Service name in Docker network
      - MQTT_PORT=${MQTT_PORT:-1883}
      - MQTT_USER=${MQTT_USER:-}
      - MQTT_PASSWORD=${MQTT_PASSWORD:-}
      
      # API Configuration (Optional)
      - API_PORT=${API_PORT:-3000}
      
      # Logging (Optional)
      - LOG_LEVEL=${LOG_LEVEL:-info}
      
      # Interval Configuration (Optional)
      - ZONE_RELOAD_INTERVAL=${ZONE_RELOAD_INTERVAL:-300}
      - TOKEN_REFRESH_INTERVAL=${TOKEN_REFRESH_INTERVAL:-21600}
      - REFERENTIALS_RELOAD_INTERVAL=${REFERENTIALS_RELOAD_INTERVAL:-86400}
      - LIVE_DATA_INTERVAL=${LIVE_DATA_INTERVAL:-300}
      
      # Display Configuration (Optional)
      - USE_GROUP_IN_NAMES=${USE_GROUP_IN_NAMES:-false}
      
      # Command Retry Configuration (Optional)
      - COMMAND_RETRY_TIMEOUT=${COMMAND_RETRY_TIMEOUT:-30}
      - COMMAND_MAX_RETRIES=${COMMAND_MAX_RETRIES:-3}
    ports:
      - "${API_PORT:-3000}:3000"
    networks:
      - rehau-network
    depends_on:
      mqtt-broker:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Home Assistant Core
  home-assistant:
    container_name: home-assistant
    image: 'ghcr.io/home-assistant/home-assistant:stable'
    ports:
      - '8123:8123'
    volumes:
      - ./homeassistant:/config
      - /etc/localtime:/etc/localtime:ro
    restart: unless-stopped
    networks:
      - rehau-network
    depends_on:
      - mqtt-broker

networks:
  rehau-network:
    driver: bridge
```

2. **Create Mosquitto configuration directory and file**:

```bash
mkdir -p mosquitto/{config,data,log}
```

Create `mosquitto/config/mosquitto.conf`:

```conf
# Mosquitto MQTT Broker Configuration

# Listener on port 1883 (standard MQTT port)
listener 1883
protocol mqtt

# Listener on port 9001 (WebSocket for browser clients)
listener 9001
protocol websockets

# Allow anonymous connections (set to false if you want authentication)
allow_anonymous true

# Persistence
persistence true
persistence_location /mosquitto/data/

# Logging
log_dest file /mosquitto/log/mosquitto.log
log_type error
log_type warning
log_type notice
log_type information
```

3. **Create a `.env` file** with your REHAU credentials:

```bash
# REHAU NEA SMART Credentials (Required)
REHAU_EMAIL=your.email@example.com
REHAU_PASSWORD=your_password

# MQTT Configuration (Optional - leave empty if no authentication)
MQTT_USER=
MQTT_PASSWORD=

# API Configuration (Optional)
API_PORT=3000

# Logging (Optional: debug|info|warn|error)
LOG_LEVEL=info

# Interval Configuration (Optional - values in seconds)
ZONE_RELOAD_INTERVAL=300
TOKEN_REFRESH_INTERVAL=21600
REFERENTIALS_RELOAD_INTERVAL=86400
LIVE_DATA_INTERVAL=300

# Display Configuration (Optional)
USE_GROUP_IN_NAMES=false

# Command Retry Configuration (Optional)
COMMAND_RETRY_TIMEOUT=30
COMMAND_MAX_RETRIES=3
```

**⚠️ IMPORTANT:** Never commit the `.env` file to version control! It contains sensitive credentials.

4. **Start all services**:

```bash
docker-compose up -d
```

5. **Verify services are running**:

```bash
docker-compose ps
```

All services should show as "Up" and "healthy".

6. **Check bridge logs**:

```bash
docker-compose logs -f rehau-bridge
```

You should see:
- ✅ MQTT connection successful
- ✅ REHAU authentication completed
- ✅ Zones loaded and published to MQTT

7. **Configure Home Assistant MQTT Integration**:

   - Access Home Assistant: `http://localhost:8123`
   - Go to **Settings** → **Devices & Services**
   - Click **Add Integration**
   - Search for **MQTT** and select it
   - Configure with:
     - **Broker**: `mqtt-broker` (Docker service name)
     - **Port**: `1883`
     - **Username/Password**: Leave empty if you haven't configured authentication
   - Enable **Enable discovery** (should be enabled by default)
   - Click **Submit**

8. **Wait for entities to appear**:

   After a few minutes, REHAU entities should appear automatically in Home Assistant via MQTT Discovery.

**Directory Structure:**

```
your-project/
├── docker-compose.yaml          # Main configuration
├── .env                         # Environment variables (create this)
├── mosquitto/
│   ├── config/
│   │   └── mosquitto.conf       # MQTT broker configuration
│   ├── data/                    # Persistent MQTT data
│   └── log/                     # Mosquitto logs
└── homeassistant/               # Home Assistant configuration directory
```

**Useful Commands:**

```bash
# Start all services
docker-compose up -d

# View bridge logs
docker-compose logs -f rehau-bridge

# Restart a specific service
docker-compose restart rehau-bridge

# Stop all services
docker-compose down

# Rebuild bridge after code changes
docker-compose build rehau-bridge
docker-compose up -d rehau-bridge

# Check service status
docker-compose ps
```

#### Option B: Using Docker Compose (Bridge Only)

If you already have an MQTT broker and Home Assistant Core running separately, you can deploy just the bridge:

1. Clone this repository:
   ```bash
   git clone https://github.com/manuxio/rehau-nea-smart-2-home-assistant.git
   cd rehau-nea-smart-2-home-assistant/rehau-nea-smart-mqtt-bridge
   ```

2. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and fill in your configuration:
   ```bash
   # Required
   REHAU_EMAIL=your.email@example.com
   REHAU_PASSWORD=your_password
   MQTT_HOST=your-mqtt-broker-host  # Use service name if same Docker network, or IP/hostname
   MQTT_PORT=1883
   
   # Optional - add MQTT credentials if needed
   MQTT_USER=your_mqtt_user
   MQTT_PASSWORD=your_mqtt_password
   ```

4. Start the bridge:
   ```bash
   docker-compose up -d
   ```

5. Check logs to verify it's running:
   ```bash
   docker-compose logs -f
   ```

#### Option C: Using Docker Directly

1. Build the image:
   ```bash
   docker build -t rehau-nea-smart-mqtt-bridge .
   ```

2. Run the container:
   ```bash
   docker run -d \
     --name rehau-bridge \
     --restart unless-stopped \
     -e REHAU_EMAIL=your.email@example.com \
     -e REHAU_PASSWORD=your_password \
     -e MQTT_HOST=your-mqtt-broker-host \
     -e MQTT_PORT=1883 \
     -e MQTT_USER=your_mqtt_user \
     -e MQTT_PASSWORD=your_mqtt_password \
     -p 3000:3000 \
     rehau-nea-smart-mqtt-bridge
   ```

#### Option D: Standalone Node.js (Development)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build TypeScript:
   ```bash
   npm run build
   ```

3. Set environment variables:
   ```bash
   export REHAU_EMAIL=your.email@example.com
   export REHAU_PASSWORD=your_password
   export MQTT_HOST=localhost
   export MQTT_PORT=1883
   ```

4. Run:
   ```bash
   npm start
   ```

### Step 4: Verify Integration

1. Wait a few minutes for the bridge to discover your REHAU installations
2. In Home Assistant, go to **Settings** → **Devices & Services** → **MQTT**
3. You should see REHAU devices appearing automatically via MQTT Discovery
4. Check the bridge logs if entities don't appear:
   ```bash
   docker-compose logs -f
   ```

### Network Configuration

**Important**: The bridge and Home Assistant Core must connect to the **same MQTT broker**.

#### If using Docker Compose for both:

```yaml
services:
  mqtt-broker:
    image: eclipse-mosquitto:latest
    networks:
      - rehau-network
  
  rehau-bridge:
    build: .
    environment:
      MQTT_HOST: mqtt-broker  # Service name in same network
    networks:
      - rehau-network
  
  home-assistant:
    # Your HA Core container
    # Configure MQTT_HOST to point to mqtt-broker
    networks:
      - rehau-network

networks:
  rehau-network:
    driver: bridge
```

#### If MQTT broker is on host network:

- Bridge `MQTT_HOST`: Use `host.docker.internal` (Docker Desktop) or host IP
- Home Assistant `MQTT_HOST`: Use `localhost` or `127.0.0.1`

### Troubleshooting

- **Entities not appearing**: Check that MQTT Discovery is enabled in Home Assistant
- **Connection errors**: Verify MQTT broker is accessible from both bridge and HA Core
- **Authentication errors**: Check REHAU credentials in `.env` file
- **MQTT connection failed**: Verify `MQTT_HOST` and `MQTT_PORT` are correct
- **Mosquitto container unhealthy**: If using the complete Docker Compose setup, ensure the healthcheck uses `pgrep mosquitto` (as shown in Option A). The healthcheck is already configured correctly in the provided example.
- **Bridge won't start**: Check that the `.env` file exists and contains valid REHAU credentials. Verify the build context path in `docker-compose.yaml` points to the correct location of the bridge source code.

---

## 🔧 Configuration

### For Home Assistant OS Add-on

Configure via the add-on's **Configuration** tab in Home Assistant:

#### Required Settings

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

#### Optional Settings

```yaml
api_port: 3000                          # REST API port (default: 3000)
log_level: info                         # debug|info|warn|error (default: info)
zone_reload_interval: 300               # Seconds between HTTPS polls (default: 300, max: 86400)
token_refresh_interval: 21600           # Seconds between token refresh (default: 21600)
referentials_reload_interval: 86400     # Seconds between referentials reload (default: 86400)
use_group_in_names: false               # Include group in display names (default: false)
```

### For Home Assistant Core

Configure via environment variables (see `.env.example` for template):

#### Required Environment Variables

```bash
REHAU_EMAIL=your.email@example.com
REHAU_PASSWORD=your_password
MQTT_HOST=localhost  # or your MQTT broker hostname/IP
MQTT_PORT=1883
```

#### Optional Environment Variables

```bash
API_PORT=3000
LOG_LEVEL=info
ZONE_RELOAD_INTERVAL=300
TOKEN_REFRESH_INTERVAL=21600
REFERENTIALS_RELOAD_INTERVAL=86400
USE_GROUP_IN_NAMES=false
```

**Configuration Notes:**
- **REHAU_EMAIL / rehau_email**: Your REHAU NEA SMART account email
- **REHAU_PASSWORD / rehau_password**: Your REHAU NEA SMART account password
- **MQTT_HOST / mqtt_host**: 
  - HA OS: Usually `core-mosquitto` if using the Mosquitto add-on
  - HA Core: Use broker hostname/IP (e.g., `localhost`, `192.168.1.100`, or Docker service name)
- **MQTT_PORT / mqtt_port**: Usually `1883` for non-TLS connections
- **MQTT_USER / mqtt_user**: Required if MQTT broker has authentication enabled
- **MQTT_PASSWORD / mqtt_password**: Required if MQTT broker has authentication enabled
- **zone_reload_interval / ZONE_RELOAD_INTERVAL**: How often to poll REHAU API for updates (lower = more frequent updates, more API calls)

---

## ✨ Features

### Climate Control
- **Climate entities** for each heating zone with full thermostat control
- **Separate temperature and humidity sensors** per zone
- **Outside temperature sensor** for the installation
- **Installation-wide mode control** (heat/cool switching)
- **Ring light control** per zone (light entity)
- **Lock control** per zone (lock entity)
- **Optimistic mode** for instant UI feedback

### LIVE Data Monitoring (v2.1.0+)
- **Mixed Circuit sensors** - Setpoint, supply, return temperatures, valve opening, pump state
- **Digital I/O sensors** - DI0-DI4, DO0-DO5 for advanced monitoring
- **Periodic polling** - Auto-refresh every 5 minutes (configurable)
- **Diagnostic entities** - Hidden by default, visible in device diagnostics

### System Features
- **Real-time MQTT updates** from REHAU system
- **Configurable update intervals** for zones, tokens, and referentials
- **Automatic token refresh** with fallback to fresh login
- **Enhanced debug logging** with sensitive data redaction
- **TypeScript implementation** with strict type safety
- **Comprehensive obfuscation** of sensitive data in info-level logs

---

## 📊 Entity Naming in Home Assistant

### Climate Entities

| Zone Name | Entity ID | MQTT Topic |
|-----------|-----------|------------|
| Living Room | `climate.rehau_xxx_ground_floor_living_room` | `homeassistant/climate/rehau_6595d1d5cceecee9ce9772e1/...` |
| Kitchen | `climate.rehau_xxx_ground_floor_kitchen` | `homeassistant/climate/rehau_6595d1d71cf174839175074b/...` |
| Bedroom 1 | `climate.rehau_xxx_first_floor_bedroom_1` | `homeassistant/climate/rehau_6595d1e16c9645c4cf338302/...` |

### Temperature Sensors

| Zone Name | Entity ID | MQTT Topic |
|-----------|-----------|------------|
| Living Room Temperature | `sensor.rehau_ground_floor_living_room_temperature` | `homeassistant/sensor/rehau_6595d1d5cceecee9ce9772e1_temperature/state` |
| Living Room Humidity | `sensor.rehau_ground_floor_living_room_humidity` | `homeassistant/sensor/rehau_6595d1d5cceecee9ce9772e1_humidity/state` |
| Living Room Demanding | `binary_sensor.rehau_ground_floor_living_room_demanding` | `homeassistant/binary_sensor/rehau_6595d1d5cceecee9ce9772e1_demanding/state` |
| Living Room Demanding Percent | `sensor.rehau_ground_floor_living_room_demanding_percent` | `homeassistant/sensor/rehau_6595d1d5cceecee9ce9772e1_demanding_percent/state` |
| Living Room Dewpoint | `sensor.rehau_ground_floor_living_room_dewpoint` | `homeassistant/sensor/rehau_6595d1d5cceecee9ce9772e1_dewpoint/state` |

### Control Entities

| Entity Type | Entity ID | MQTT Topic |
|-------------|-----------|------------|
| Ring Light | `light.rehau_xxx_ground_floor_living_room_ring_light` | `homeassistant/light/rehau_6595d1d5cceecee9ce9772e1_ring_light/...` |
| Lock | `lock.rehau_xxx_ground_floor_living_room_lock` | `homeassistant/lock/rehau_6595d1d5cceecee9ce9772e1_lock/...` |

### Entity ID Structure

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

### MQTT Topic Structure (v2.3.3+)

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

---

## 🐛 Debugging & Troubleshooting

### Enabling Debug Mode

To enable detailed logging for troubleshooting:

1. Go to the add-on **Configuration** tab
2. Set `log_level: "debug"`
3. Restart the add-on
4. Check the **Log** tab for detailed output

**⚠️ IMPORTANT - Debug Mode Warning:**

When debug mode is enabled, the add-on will log **detailed information** including:
- Full MQTT messages
- HTTP requests and responses
- Authentication tokens and session data
- Installation details

**Sensitive data is automatically redacted** in debug logs:
- ✅ Passwords → `[REDACTED]`
- ✅ Tokens → First 2 and last 2 characters shown (e.g., `ey...PM`)
- ✅ Email addresses → Partially masked (e.g., `ma...et`)
- ✅ Installation addresses → `[REDACTED]`
- ✅ GPS coordinates → `[REDACTED]`

However, **other personal information may still be visible**:
- Installation names
- Zone names
- Temperature values
- System configuration

### Sharing Logs Safely

When sharing logs on GitHub issues or public forums:

1. **Always review logs before sharing** - even with redaction enabled
2. **Check for personal information**:
   - Installation names (e.g., "John's House")
   - Zone names (e.g., "Master Bedroom")
   - Any other identifying information
3. **Use debug mode only when needed** - switch back to `info` level after troubleshooting
4. **Copy only relevant sections** - don't share entire log files
5. **Use code blocks** when pasting logs in GitHub issues:
   ````
   ```text
   [paste your log excerpt here]
   ```
   ````

### Common Issues

#### Add-on won't start
- Check the Log tab for error messages
- Verify your REHAU credentials are correct
- Ensure MQTT broker is running and accessible

#### No entities appearing
- Check that MQTT integration is set up in Home Assistant
- Verify the add-on is connected to MQTT (check logs)
- Wait a few minutes for discovery to complete
- Restart MQTT integration if needed

#### Entities show as unavailable
- Check MQTT broker is running
- Verify MQTT credentials in add-on configuration
- Restart the add-on
- Check MQTT connection in logs

#### Wrong Temperature Readings
1. **Check zone mapping** in add-on logs (set `log_level: debug`)
2. **Verify zone IDs** match between REHAU app and Home Assistant
3. **Restart add-on** to refresh all data

#### Old Entities Still Visible (After v2.3.3 Upgrade)
1. **Delete old MQTT devices** manually from Home Assistant
2. **Clear MQTT retained messages** (see Migration Guide Step 3 Option B)
3. **Restart Home Assistant**

### Common Debug Scenarios

**Connection Issues:**
```yaml
log_level: "debug"
```
Look for:
- MQTT connection messages
- Authentication errors
- Network timeouts

**Missing Sensors:**
```yaml
log_level: "debug"
```
Look for:
- LIVE_EMU and LIVE_DIDO responses
- Sensor discovery messages
- MQTT publish confirmations

**Temperature/Control Issues:**
```yaml
log_level: "debug"
```
Look for:
- Zone update messages
- Command messages to REHAU
- Temperature conversion logs

---

## 🛠️ Developer Tools

This project includes standalone parsers for REHAU API responses:

```bash
# Parse user data from JSON file
npm run parseUserData -- user-data.json
npm run parseUserData -- user-data.json --summary

# Parse installation data from JSON file
npm run parseInstallationData -- installation-data.json
npm run parseInstallationData -- installation-data.json --summary
```

These tools are useful for:
- Debugging API responses from users
- Analyzing installation configurations
- Testing parser logic independently

See [Parser Documentation](rehau-nea-smart-mqtt-bridge/src/parsers/README.md) for details.

---

## 📚 Documentation

- **[CHANGELOG](rehau-nea-smart-mqtt-bridge/CHANGELOG.md)** - Version history and release notes
- **[Parser Documentation](rehau-nea-smart-mqtt-bridge/src/parsers/README.md)** - API response parser tools and CLI usage

---

## 🚀 Future Enhancements

Based on the REHAU NEA SMART protocol analysis, the following features are planned for future releases:

### 🎯 Planned Features

#### 1. **Schedule/Program Support** (High Priority)
- **Auto Mode Integration**: Support for `AUTO_NORMAL_3` and `AUTO_REDUCED_4` modes
- **Schedule Display**: Show active schedule/program in Home Assistant
- **Schedule Override**: Temporary manual override with automatic return to schedule
- **Implementation Status**: 🔴 Not Started
- **Complexity**: High (requires understanding REHAU schedule format)

#### 2. **Party Mode** (Medium Priority)
- **Local Party Mode**: `PARTY_LOCAL_6` - Override for single zone
- **Global Party Mode**: `PARTY_GLOBAL_7` - Override for entire installation
- **Duration Control**: Set party mode duration
- **Auto Return**: Automatic return to normal mode after duration
- **Implementation Status**: 🔴 Not Started
- **Complexity**: Medium (mode constants already documented)

#### 3. **Advanced Mode Support** (Medium Priority)
- **Manual Mode**: `MANUAL_5` - Full manual control
- **Global Absence**: `GLOBAL_ABSENCE_9` - Entire installation away mode
- **Global Reduced**: `GLOBAL_REDUCED_10` - Entire installation reduced mode
- **Holiday Mode**: `STANDBY_HOLIDAY_11` - Vacation/holiday mode with frost protection
- **Implementation Status**: 🔴 Not Started
- **Complexity**: Medium

#### 4. **Enhanced Setpoint Management** (Low Priority)
- **Standby Setpoint Display**: Show `setpoint_h_standby` (frost protection) as read-only
- **Setpoint History**: Track setpoint changes over time
- **Setpoint Validation**: Prevent invalid setpoint values
- **Implementation Status**: 🔴 Not Started
- **Complexity**: Low

#### 5. **System Mode Detection** (Low Priority)
- **Operating Mode Display**: Show if system is in `HEATING_ONLY`, `COOLING_ONLY`, or `AUTO` mode
- **Mode Constraints**: Prevent invalid mode combinations
- **Mode Recommendations**: Suggest optimal mode based on season/temperature
- **Implementation Status**: 🔴 Not Started
- **Complexity**: Low

### 📋 Technical Reference

The add-on now correctly handles:
- ✅ **Setpoint Selection**: Automatically selects correct setpoint (`setpoint_h_normal`, `setpoint_h_reduced`, `setpoint_c_normal`, `setpoint_c_reduced`) based on mode and preset
- ✅ **OFF Mode Handling**: Publishes "None" for temperature and preset when zone is off
- ✅ **Multi-Controller Support**: Correctly routes commands to zones on different controllers
- ✅ **Mode Constants**: Uses REHAU protocol mode values (0=Comfort, 1=Away, 2=Standby, etc.)
- ✅ **Read/Write Separation**: Correctly implements REHAU's setpoint architecture

#### Understanding REHAU Setpoints

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

### 🤝 Contributing

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

---

## 💬 Support

For issues and feature requests, please visit:
https://github.com/manuxio/rehau-nea-smart-2-home-assistant/issues

**Before opening an issue:**
1. Enable debug mode (`log_level: "debug"`) and review logs
2. Check existing issues for similar problems
3. Include add-on version, Home Assistant version, and relevant log excerpts
4. Review the debugging guide above

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

This project is a community effort to integrate REHAU NEA SMART 2.0 systems with Home Assistant. Special thanks to all contributors and users who have helped improve this integration.

**Remember:** This is an unofficial integration not affiliated with REHAU.
