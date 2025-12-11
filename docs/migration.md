# Migration Guide (v2.3.3)

## ⚠️ REQUIRED STEPS - DO NOT SKIP

### Step 1: Backup Your Configuration

```bash
# Backup automations and scripts that use REHAU entities
# You'll need to update entity IDs after migration
```

### Step 2: Uninstall Add-on

1. Go to **Settings** → **Add-ons** → **REHAU NEA SMART MQTT Bridge**
2. Click **Uninstall**
3. Wait for complete removal

### Step 3: Remove Old Entities

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

### Step 4: Reinstall Add-on

1. Go to **Settings** → **Add-ons** → **Add-on Store**
2. Find **REHAU NEA SMART MQTT Bridge**
3. Click **Install**
4. Configure with your REHAU credentials (see [Configuration Guide](./configuration.md))
5. Start the add-on

### Step 5: Verify New Entities

1. Go to **Settings** → **Devices & Services** → **MQTT**
2. New REHAU devices should appear automatically
3. Check that all zones are present and showing correct temperatures

### Step 6: Update Automations & Scripts

- Entity IDs have changed (see [Entity Naming Guide](./entities.md))
- Update all references in automations, scripts, and dashboards

## Related Documentation

- [Breaking Changes](./breaking-changes.md) - Details about what changed
- [Entity Naming](./entities.md) - New entity ID structure
- [Configuration Guide](./configuration.md) - How to configure the add-on
