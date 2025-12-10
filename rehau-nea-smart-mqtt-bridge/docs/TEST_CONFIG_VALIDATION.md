# Testing Configuration Validation

Questo documento descrive come testare la validazione della configurazione runtime.

## Test Automatici

Esegui la suite di test completa:

```bash
npm run test:config-validation
```

Questo esegue 16 test case che coprono:
- ✅ Configurazione valida
- ❌ Email mancante o formato invalido
- ⚠️ Password troppo corta (warning)
- ❌ Porte MQTT/API fuori range
- ❌ Username MQTT senza password
- ❌ Hostname invalido
- ✅ Indirizzo IPv4 valido
- ❌ Intervalli fuori range
- ⚠️ LOG_LEVEL invalido (warning)
- ⚠️ USE_GROUP_IN_NAMES invalido (warning)

## Test Manuali

Puoi testare manualmente cambiando le variabili d'ambiente prima di avviare l'applicazione.

### Test 1: Configurazione Valida

```bash
export REHAU_EMAIL="test@example.com"
export REHAU_PASSWORD="password123"
export MQTT_HOST="localhost"
export MQTT_PORT="1883"
export API_PORT="3000"
npm run dev
```

**Risultato atteso**: L'applicazione si avvia senza errori.

### Test 2: Email Mancante

```bash
unset REHAU_EMAIL
export REHAU_PASSWORD="password123"
export MQTT_HOST="localhost"
export MQTT_PORT="1883"
npm run dev
```

**Risultato atteso**: 
```
❌ Configuration validation failed
  [REHAU_EMAIL] REHAU email is required
```
Exit code: 1

### Test 3: Email Formato Invalido

```bash
export REHAU_EMAIL="not-an-email"
export REHAU_PASSWORD="password123"
export MQTT_HOST="localhost"
export MQTT_PORT="1883"
npm run dev
```

**Risultato atteso**: Errore di validazione per formato email invalido.

### Test 4: Password Troppo Corta (Warning)

```bash
export REHAU_EMAIL="test@example.com"
export REHAU_PASSWORD="short"
export MQTT_HOST="localhost"
export MQTT_PORT="1883"
npm run dev
```

**Risultato atteso**: Warning ma l'applicazione continua:
```
⚠️  Configuration warnings
  [REHAU_PASSWORD] REHAU password is less than 8 characters (security warning)
```

### Test 5: Porta MQTT Fuori Range

```bash
export REHAU_EMAIL="test@example.com"
export REHAU_PASSWORD="password123"
export MQTT_HOST="localhost"
export MQTT_PORT="70000"
npm run dev
```

**Risultato atteso**: Errore per porta fuori range (1-65535).

### Test 6: Porta API Troppo Bassa

```bash
export REHAU_EMAIL="test@example.com"
export REHAU_PASSWORD="password123"
export MQTT_HOST="localhost"
export MQTT_PORT="1883"
export API_PORT="80"
npm run dev
```

**Risultato atteso**: Errore per porta < 1024 (richiede privilegi root).

### Test 7: Username MQTT Senza Password

```bash
export REHAU_EMAIL="test@example.com"
export REHAU_PASSWORD="password123"
export MQTT_HOST="localhost"
export MQTT_PORT="1883"
export MQTT_USER="mqttuser"
# MQTT_PASSWORD non impostato
npm run dev
```

**Risultato atteso**: Errore perché password è richiesta quando username è presente.

### Test 8: Hostname Invalido

```bash
export REHAU_EMAIL="test@example.com"
export REHAU_PASSWORD="password123"
export MQTT_HOST="invalid..hostname"
export MQTT_PORT="1883"
npm run dev
```

**Risultato atteso**: Errore per formato hostname invalido.

### Test 9: Intervallo Fuori Range

```bash
export REHAU_EMAIL="test@example.com"
export REHAU_PASSWORD="password123"
export MQTT_HOST="localhost"
export MQTT_PORT="1883"
export ZONE_RELOAD_INTERVAL="10"  # Minimo è 30
npm run dev
```

**Risultato atteso**: Errore per intervallo fuori range.

### Test 10: LOG_LEVEL Invalido (Warning)

```bash
export REHAU_EMAIL="test@example.com"
export REHAU_PASSWORD="password123"
export MQTT_HOST="localhost"
export MQTT_PORT="1883"
export LOG_LEVEL="invalid_level"
npm run dev
```

**Risultato atteso**: Warning ma l'applicazione continua con default 'info'.

## Test con Docker

Se stai usando Docker, puoi testare passando variabili d'ambiente:

```bash
docker run -e REHAU_EMAIL="test@example.com" \
           -e REHAU_PASSWORD="password123" \
           -e MQTT_HOST="localhost" \
           -e MQTT_PORT="70000" \
           your-image
```

## Test con Home Assistant Add-on

Per testare come add-on di Home Assistant, modifica `/data/options.json`:

```json
{
  "rehau_email": "",
  "rehau_password": "password123",
  "mqtt_host": "localhost",
  "mqtt_port": 1883
}
```

Poi riavvia l'add-on e controlla i log per gli errori di validazione.

## Verifica Output

Quando la validazione fallisce, vedrai output formattato come:

```
═══════════════════════════════════════════════════════════════
❌ Configuration validation failed
═══════════════════════════════════════════════════════════════
  [REHAU_EMAIL] REHAU email is required
  [MQTT_PORT] MQTT port must be between 1 and 65535 (got: 70000)
═══════════════════════════════════════════════════════════════
```

Quando ci sono solo warning:

```
═══════════════════════════════════════════════════════════════
⚠️  Configuration warnings
═══════════════════════════════════════════════════════════════
  [REHAU_PASSWORD] REHAU password is less than 8 characters (security warning)
═══════════════════════════════════════════════════════════════
```

## Note

- I valori di default vengono loggati quando vengono usati
- Gli errori critici causano exit(1) e impediscono l'avvio
- I warning non bloccano l'avvio ma indicano configurazioni non raccomandate
- La validazione avviene PRIMA dell'inizializzazione di qualsiasi componente

