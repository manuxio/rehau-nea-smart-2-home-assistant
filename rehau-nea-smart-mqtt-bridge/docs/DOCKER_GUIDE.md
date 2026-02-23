# Docker Build and Run Guide

## Building the Docker Image

### Build Command:

```bash
docker build -t rehau-nea-smart-mqtt-bridge:latest .
```

### Build with specific Node version:

```bash
docker build --build-arg BUILD_FROM=node:20-alpine -t rehau-nea-smart-mqtt-bridge:latest .
```

### Multi-platform build (for Home Assistant):

```bash
docker buildx build --platform linux/amd64,linux/arm64,linux/arm/v7 -t rehau-nea-smart-mqtt-bridge:latest .
```

---

## Running the Docker Container

### Standalone Mode (using environment variables):

```bash
docker run -d \
  --name rehau-bridge \
  -p 3000:3000 \
  -e REHAU_EMAIL="your.email@example.com" \
  -e REHAU_PASSWORD="your_password" \
  -e MQTT_HOST="192.168.1.100" \
  -e MQTT_PORT="1883" \
  -e MQTT_USER="mqtt_user" \
  -e MQTT_PASSWORD="mqtt_password" \
  -e POP3_EMAIL="your.email@gmx.com" \
  -e POP3_PASSWORD="your_pop3_password" \
  -e POP3_HOST="pop.gmx.com" \
  -e POP3_PORT="995" \
  -e POP3_SECURE="true" \
  -e API_ENABLED="true" \
  -e WEB_UI_ENABLED="true" \
  -e API_PORT="3000" \
  -e LOG_LEVEL="info" \
  rehau-nea-smart-mqtt-bridge:latest
```

### Using .env file:

```bash
docker run -d \
  --name rehau-bridge \
  -p 3000:3000 \
  --env-file .env \
  rehau-nea-smart-mqtt-bridge:latest
```

### With Docker Compose:

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  rehau-bridge:
    image: rehau-nea-smart-mqtt-bridge:latest
    container_name: rehau-bridge
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      # REHAU Account
      REHAU_EMAIL: "your.email@example.com"
      REHAU_PASSWORD: "your_password"
      
      # MQTT Broker
      MQTT_HOST: "mqtt-broker"
      MQTT_PORT: "1883"
      MQTT_USER: "mqtt_user"
      MQTT_PASSWORD: "mqtt_password"
      
      # POP3 (for 2FA)
      POP3_PROVIDER: "basic"
      POP3_EMAIL: "your.email@gmx.com"
      POP3_PASSWORD: "your_pop3_password"
      POP3_HOST: "pop.gmx.com"
      POP3_PORT: "995"
      POP3_SECURE: "true"
      
      # API & Web UI
      API_ENABLED: "true"
      WEB_UI_ENABLED: "true"
      API_PORT: "3000"
      API_USERNAME: "admin"
      API_PASSWORD: "your_secure_password"
      JWT_SECRET: "your_jwt_secret"
      
      # Logging
      LOG_LEVEL: "info"
      LOG_SHOW_OK_REQUESTS: "false"
      
      # Playwright
      PLAYWRIGHT_HEADLESS: "true"
      
    networks:
      - rehau-network
    depends_on:
      - mqtt-broker

  mqtt-broker:
    image: eclipse-mosquitto:latest
    container_name: mqtt-broker
    restart: unless-stopped
    ports:
      - "1883:1883"
    volumes:
      - ./mosquitto/config:/mosquitto/config
      - ./mosquitto/data:/mosquitto/data
      - ./mosquitto/log:/mosquitto/log
    networks:
      - rehau-network

networks:
  rehau-network:
    driver: bridge
```

Then run:

```bash
docker-compose up -d
```

---

## Accessing the Application

- **Web UI**: http://localhost:3000
- **API Docs**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/health

---

## Environment Variables

See `.env.example` for complete list of environment variables.

### Required:
- `REHAU_EMAIL` - Your REHAU account email
- `REHAU_PASSWORD` - Your REHAU account password
- `MQTT_HOST` - MQTT broker hostname/IP

### Optional (with defaults):
- `MQTT_PORT=1883` - MQTT broker port
- `API_PORT=3000` - API and Web UI port
- `LOG_LEVEL=info` - Logging level
- `PLAYWRIGHT_HEADLESS=true` - Headless browser mode

---

## Troubleshooting

### Check logs:

```bash
docker logs rehau-bridge
```

### Check logs (follow):

```bash
docker logs -f rehau-bridge
```

### Enter container:

```bash
docker exec -it rehau-bridge sh
```

### Check if web UI files exist:

```bash
docker exec rehau-bridge ls -la /app/web-ui/dist
```

### Verify Chromium installation:

```bash
docker exec rehau-bridge chromium --version
```

---

## Home Assistant Addon

For Home Assistant addon, the image is built automatically by Home Assistant using `config.yaml` and `build.yaml`.

The addon uses `/data/options.json` for configuration instead of environment variables.

---

## Notes

- The image uses multi-stage build to minimize size
- Web UI is built during Docker build (not at runtime)
- Chromium is included for Playwright authentication
- Health check endpoint is `/health`
- Logs are written to stdout (visible with `docker logs`)
