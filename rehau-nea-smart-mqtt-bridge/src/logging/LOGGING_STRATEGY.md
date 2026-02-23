# Logging Strategy - Readable vs Shareable

## Problem Statement

Current logging obfuscates personal information (room names, emails, installation names) to protect privacy when sharing logs. However, this makes logs difficult to read and debug for the actual user.

## Solution: Dual Mode Logging

### Default Mode: Readable Logs
Show real names for user's own debugging. This is what users see in their own system.

```
2026-02-21 14:23:15 [INFO] [Auth] User john.doe@gmail.com authenticated successfully
2026-02-21 14:23:16 [INFO] [MQTT] Connected to broker at core-mosquitto:1883
2026-02-21 14:23:17 [INFO] [Installation] Found installation: "My Home"
2026-02-21 14:23:18 [INFO] [Zone] Initialized zone: "Living Room" (ID: 507f1f77bcf86cd799439011)
2026-02-21 14:23:19 [INFO] [Zone] Initialized zone: "Master Bedroom" (ID: 507f191e810c19729de860ea)
2026-02-21 14:23:20 [INFO] [Climate] Published discovery for "My Home - Living Room"
2026-02-21 14:24:30 [INFO] [Command] Zone "Living Room" temperature set to 22.0°C
2026-02-21 14:24:31 [DEBUG] [MQTT] Published: rehau/my_home/living_room/temperature/set = 22.0
2026-02-21 14:24:32 [INFO] [REHAU] Command sent successfully to zone "Living Room"
2026-02-21 14:24:33 [INFO] [Update] Zone "Living Room" current temperature: 21.5°C
```

### Shareable Mode: Privacy-Protected Logs
Obfuscate personal information for sharing on GitHub, forums, or with developers.

```
2026-02-21 14:23:15 [INFO] [Auth] User j***@g***.com authenticated successfully
2026-02-21 14:23:16 [INFO] [MQTT] Connected to broker at core-mosquitto:1883
2026-02-21 14:23:17 [INFO] [Installation] Found installation: "Install_1"
2026-02-21 14:23:18 [INFO] [Zone] Initialized zone: "Zone_A" (ID: hash_abc123)
2026-02-21 14:23:19 [INFO] [Zone] Initialized zone: "Zone_B" (ID: hash_def456)
2026-02-21 14:23:20 [INFO] [Climate] Published discovery for "Install_1 - Zone_A"
2026-02-21 14:24:30 [INFO] [Command] Zone "Zone_A" temperature set to 22.0°C
2026-02-21 14:24:31 [DEBUG] [MQTT] Published: rehau/install1/zonea/temperature/set = 22.0
2026-02-21 14:24:32 [INFO] [REHAU] Command sent successfully to zone "Zone_A"
2026-02-21 14:24:33 [INFO] [Update] Zone "Zone_A" current temperature: 21.5°C
```

## Obfuscation Rules

### What Gets Obfuscated:

1. **Email Addresses**
   - `john.doe@gmail.com` → `j***@g***.com`
   - Keep first letter of username and domain

2. **Installation Names**
   - `My Home` → `Install_1`
   - `Summer House` → `Install_2`
   - Consistent mapping (same name = same ID)

3. **Zone/Room Names**
   - `Living Room` → `Zone_A`
   - `Master Bedroom` → `Zone_B`
   - `Kitchen` → `Zone_C`
   - Alphabetical assignment per installation

4. **MongoDB ObjectIDs**
   - `507f1f77bcf86cd799439011` → `hash_abc123`
   - Consistent hashing (same ID = same hash)

5. **IP Addresses** (if logged)
   - `192.168.1.100` → `192.168.x.x`
   - `10.0.0.50` → `10.0.x.x`

### What Stays Visible:

1. **Temperatures** - `21.5°C`, `22.0°C`
2. **Modes** - `heat`, `cool`, `off`
3. **Presets** - `comfort`, `away`
4. **Error Messages** - Full error text
5. **Timestamps** - Full timestamps
6. **Component Names** - `[Auth]`, `[MQTT]`, `[Zone]`
7. **Status Values** - `connected`, `disconnected`, `authenticating`
8. **Numeric Values** - Humidity, demand, setpoints
9. **MQTT Broker** - `core-mosquitto` (standard HA name)

## Implementation

### Logger Interface

```typescript
interface Logger {
  // Normal logging (shows real names)
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  
  // Get logs
  getLogs(options?: LogOptions): LogEntry[];
  
  // Get shareable logs (obfuscated)
  getShareableLogs(options?: LogOptions): LogEntry[];
  
  // Export logs
  exportLogs(format: 'text' | 'json'): string;
  exportShareableLogs(format: 'text' | 'json'): string;
}

interface LogContext {
  component: 'auth' | 'mqtt' | 'zone' | 'installation' | 'api' | 'rehau';
  installationId?: string;
  installationName?: string;
  zoneId?: string;
  zoneName?: string;
  operation?: string;
  duration?: number;
}

interface LogEntry {
  timestamp: Date;
  level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  component: string;
  message: string;
  context?: LogContext;
  error?: Error;
}
```

### Usage Examples

```typescript
// In zone update handler
logger.info('Zone temperature updated', {
  component: 'zone',
  zoneName: 'Living Room',
  zoneId: zone._id,
  operation: 'temperature_update'
});

// In authentication
logger.info('User authenticated successfully', {
  component: 'auth',
  operation: 'login',
  duration: 2340 // ms
});

// In MQTT handler
logger.debug('MQTT message published', {
  component: 'mqtt',
  installationName: installation.name,
  zoneName: zone.name,
  operation: 'publish'
});
```

### Obfuscation Mapping

The logger maintains consistent mappings:

```typescript
class LogSanitizer {
  private emailMap = new Map<string, string>();
  private installationMap = new Map<string, string>();
  private zoneMap = new Map<string, string>();
  private idMap = new Map<string, string>();
  
  obfuscateEmail(email: string): string {
    if (!this.emailMap.has(email)) {
      const [user, domain] = email.split('@');
      const obfuscated = `${user[0]}***@${domain[0]}***.${domain.split('.').pop()}`;
      this.emailMap.set(email, obfuscated);
    }
    return this.emailMap.get(email)!;
  }
  
  obfuscateInstallation(name: string): string {
    if (!this.installationMap.has(name)) {
      const index = this.installationMap.size + 1;
      this.installationMap.set(name, `Install_${index}`);
    }
    return this.installationMap.get(name)!;
  }
  
  obfuscateZone(name: string, installationId: string): string {
    const key = `${installationId}:${name}`;
    if (!this.zoneMap.has(key)) {
      const letter = String.fromCharCode(65 + this.zoneMap.size); // A, B, C...
      this.zoneMap.set(key, `Zone_${letter}`);
    }
    return this.zoneMap.get(key)!;
  }
  
  obfuscateId(id: string): string {
    if (!this.idMap.has(id)) {
      const hash = crypto.createHash('md5').update(id).digest('hex').substring(0, 6);
      this.idMap.set(id, `hash_${hash}`);
    }
    return this.idMap.get(id)!;
  }
}
```

## Web UI Integration

### Log Viewer Component

```tsx
function LogViewer() {
  const [mode, setMode] = useState<'normal' | 'shareable'>('normal');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  return (
    <div>
      <div className="log-controls">
        <ToggleButton
          value={mode}
          onChange={setMode}
          options={[
            { value: 'normal', label: 'Normal Logs' },
            { value: 'shareable', label: 'Shareable Logs' }
          ]}
        />
        
        {mode === 'shareable' && (
          <Alert severity="info">
            Personal information is hidden. Safe to share on GitHub.
          </Alert>
        )}
        
        <Button onClick={() => downloadLogs(mode)}>
          Download {mode === 'shareable' ? 'Shareable' : ''} Logs
        </Button>
      </div>
      
      <LogList logs={logs} mode={mode} />
    </div>
  );
}
```

### API Endpoints

```
GET  /api/v1/logs?mode=normal          # Default: real names
GET  /api/v1/logs?mode=shareable       # Obfuscated
POST /api/v1/logs/export               # Download normal logs
POST /api/v1/logs/export/shareable     # Download shareable logs
```

## Benefits

1. **For Users**: 
   - Easy to read and understand their own logs
   - Can see actual room names and installations
   - Better debugging experience

2. **For Support**:
   - Users can safely share logs without privacy concerns
   - Consistent obfuscation makes patterns visible
   - Still contains all technical information needed

3. **For Developers**:
   - Can request shareable logs from users
   - No privacy concerns when logs are posted publicly
   - Easier to help users troubleshoot

## Configuration

```yaml
# Home Assistant addon config
log_level: "info"                    # error, warn, info, debug, trace
log_format: "simple"                 # simple, json
log_show_real_names: true            # Default: true (show real names)
log_max_size: "10m"                  # Max log file size
log_max_files: 5                     # Number of rotated logs
```

## Migration from Current System

Current system obfuscates by default. New system:

1. **Phase 1**: Add dual-mode logging
2. **Phase 2**: Default to readable logs (breaking change, document well)
3. **Phase 3**: Add "Share Logs" button in UI
4. **Phase 4**: Remove old obfuscation system

Users upgrading will see:
```
⚠️  Logging behavior changed in v5.0.0
Logs now show real room names by default for easier debugging.
Use "Share Logs" button to export privacy-protected logs for sharing.
```
