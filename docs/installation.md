# Installation Guide

This guide covers installation for both Home Assistant OS (Add-on) and Home Assistant Core (Docker).

## Home Assistant OS (Add-on Installation)

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

See [Configuration Guide](./configuration.md) for detailed configuration instructions.

### Step 4: Start the Add-on

1. Go to the **Info** tab
2. Click **Start**
3. Enable **Start on boot** if you want it to start automatically
4. Check the **Log** tab to verify it's running correctly

---

## Home Assistant Core (Docker Installation)

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

For more detailed troubleshooting, see the [Troubleshooting Guide](./troubleshooting.md).
