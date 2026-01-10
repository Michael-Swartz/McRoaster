# WebSocket Message Schema

This document defines the WebSocket message schema for communication between the Arduino R4 WiFi and the Next.js web interface.

## Overview

- **Protocol**: WebSocket
- **Port**: 81 (default WebSocket port, HTTP remains on 80)
- **Message Format**: JSON
- **Encoding**: UTF-8
- **Auto-Discovery**: mDNS hostname `mcroaster.local` for zero-configuration networking

## Hardware Setup

### Wiring Diagram

```
                                    ┌─────────────────────────────────┐
                                    │   AC Power (120V/240V)          │
                                    └──────────┬──────────────────────┘
                                               │
                                               │ Hot (L)
                     ┌─────────────────────────┴─────────┐
                     │                                   │
                     │  Solid State Relay (SSR)          │
                     │  (e.g., Fotek SSR-25 DA)          │
                     │                                   │
                     │  Input: 3-32V DC                  │
                     │  Output: 24-380V AC, 25A          │
                     │                                   │
                     │  [+] ◄─────┐                      │
                     │  [-] ◄─────┼───── GND             │
                     │            │                      │
                     │  [1] ─────►│                      │
                     │  [2] ─────►├─────────────────────►│─── To Heating Element
                     └────────────┼──────────────────────┘
                                  │
                                  │ Control Signal
                                  │ (Digital Pin)
                     ┌────────────┴──────────────┐
                     │   Arduino R4 WiFi         │
                     │                           │
                     │   GPIO Pin (e.g., D5) ────┤
                     │   GND ─────────────────────┤
                     │                           │
                     │   Thermocouple (MAX6675)  │
                     │   Motor Driver (L298N)    │
                     └───────────────────────────┘
                                  │
                     ┌────────────┴──────────────┐
                     │  Heating Element          │
                     │  (1400W)                  │
                     │                           │
                     │  Return ──────────────────┤─── Neutral (N)
                     └───────────────────────────┘

Safety Notes:
- Use a SSR rated for at least 1.5x the load (1400W ÷ 120V = 11.7A → use 25A SSR)
- Ensure proper heat sinking for the SSR
- Add a fuse on the AC side (15A recommended)
- Never work on AC wiring with power connected
- Follow local electrical codes
```

## Message Structure

All messages follow a common envelope structure:

```json
{
  "type": "<message_type>",
  "timestamp": <unix_timestamp_ms>,
  "payload": { ... }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Message type identifier |
| `timestamp` | number | Unix timestamp in milliseconds |
| `payload` | object | Message-specific data |

---

## Arduino to Frontend (Outbound Messages)

### `state`

Full state update sent periodically or on change.

```json
{
  "type": "state",
  "timestamp": 1704567890123,
  "payload": {
    "temperature": {
      "value": 25.5,
      "unit": "C"
    },
    "motor": {
      "on": false,
      "driverPowered": true
    },
    "heater": {
      "on": false,
      "power": 1400
    }
  }
}
```

### `temperature`

Temperature-only update from thermocouple (sent every 2 seconds).

```json
{
  "type": "temperature",
  "timestamp": 1704567890123,
  "payload": {
    "value": 25.5,
    "unit": "C"
  }
}
```

### `heaterSafety`

Heating element safety temperature from 100kΩ thermistor (sent every 2 seconds or on critical threshold).

```json
{
  "type": "heaterSafety",
  "timestamp": 1704567890123,
  "payload": {
    "temperature": 185.5,
    "unit": "C",
    "status": "normal"
  }
}
```

**Status Values:**
- `normal` - Temperature below 180°C
- `warning` - Temperature between 180-200°C
- `critical` - Temperature between 200-210°C
- `emergency` - Temperature ≥ 210°C (heater auto-disabled)

### `motor`

Motor state change notification.

```json
{
  "type": "motor",
  "timestamp": 1704567890123,
  "payload": {
    "on": true,
    "driverPowered": true
  }
}
```

### `heater`

Heater state change notification.

```json
{
  "type": "heater",
  "timestamp": 1704567890123,
  "payload": {
    "on": true,
    "power": 1400
  }
}
```

### `error`

Error notification from Arduino.

```json
{
  "type": "error",
  "timestamp": 1704567890123,
  "payload": {
    "code": "THERMOCOUPLE_OPEN",
    "message": "Thermocouple open circuit!"
  }
}
```

#### Error Codes

| Code | Description |
|------|-------------|
| `THERMOCOUPLE_OPEN` | Thermocouple open circuit detected |
| `THERMOCOUPLE_SHORT_GND` | Thermocouple shorted to ground |
| `THERMOCOUPLE_SHORT_VCC` | Thermocouple shorted to VCC |
| `WIFI_DISCONNECTED` | WiFi connection lost |
| `DRIVER_POWER_LOST` | L298N motor driver lost power |
| `HEATER_OVERHEAT` | Heating element temperature exceeded 210°C |
| `HEATER_CRITICAL` | Heating element approaching thermal limit |
| `SSR_FAILURE` | Solid state relay failure detected |
| `THERMISTOR_FAULT` | Safety thermistor reading error |

### `connected`

Sent when a client connects to confirm connection.

```json
{
  "type": "connected",
  "timestamp": 1704567890123,
  "payload": {
    "ip": "192.168.1.100",
    "firmware": "1.0.0"
  }
}
```

---

### `setMotor`

Command to turn motor on/off.

```json
{
  "type": "setMotor",
  "timestamp": 1704567890123,
  "payload": {
    "on": true
  }
}
```

### `setHeater`

Command to turn heater on/off.

```json
{
  "type": "setHeater",
  "timestamp": 1704567890123,
  "payload": {
    "on": true
  }
}
```

**Safety Note**: The Arduino firmware should implement temperature safety limits and automatically turn off the heater if temperature exceeds safe thresholds.
}
```

### `getState`

Request full state update.

```json
{
  "type": "getState",
  "timestamp": 1704567890123,
  "payload": {}
}
```

### `setConfig`

Update configuration (future).

```json
{
  "type": "setConfig",
  "timestamp": 1704567890123,
  "payload": {
    "tempInterval": 2000
  }
}
```

---

## TypeScript Types

For use in the Next.js frontend:

```typescript
// Base message envelope
interface WebSocketMessage<T = unknown> {
  type: string;
  timestamp: number;
  payload: T;
}

// Payload types
interface TemperaturePayload {
  value: number;
  unit: 'C';
}

interface HeaterSafetyPayload {
  temperature: number;
  unit: 'C';
  status: 'normal' | 'warning' | 'critical' | 'emergency';
}

interface MotorPayload {
  on: boolean;
  driverPowered: boolean;
}

interface HeaterPayload {
  on: boolean;
  power: number;
}

interface StatePayload {
  temperature: TemperaturePayload;
  motor: MotorPayload;
  heater: HeaterPayload;
}

interface ErrorPayload {
  code: string;
  message: string;
}

interface ConnectedPayload {
  ip: string;
  firmware: string;
}

// Outbound message types (Arduino -> Frontend)
type TemperatureMessage = WebSocketMessage<TemperaturePayload> & { type: 'temperature' };
type HeaterSafetyMessage = WebSocketMessage<HeaterSafetyPayload> & { type: 'heaterSafety' };
type MotorMessage = WebSocketMessage<MotorPayload> & { type: 'motor' };
type HeaterMessage = WebSocketMessage<HeaterPayload> & { type: 'heater' };
type StateMessage = WebSocketMessage<StatePayload> & { type: 'state' };
type ErrorMessage = WebSocketMessage<ErrorPayload> & { type: 'error' };
type ConnectedMessage = WebSocketMessage<ConnectedPayload> & { type: 'connected' };

type OutboundMessage =
  | TemperatureMessage
  | HeaterSafetyMessage
  | MotorMessage
  | HeaterMessage
  | StateMessage
  | ErrorMessage
  | ConnectedMessage;

// Inbound message types (Frontend -> Arduino)
interface SetMotorPayload {
  on: boolean;
}

interface SetHeaterPayload {
  on: boolean;
}

type SetMotorMessage = WebSocketMessage<SetMotorPayload> & { type: 'setMotor' };
type SetHeaterMessage = WebSocketMessage<SetHeaterPayload> & { type: 'setHeater' };
type GetStateMessage = WebSocketMessage<Record<string, never>> & { type: 'getState' };

type InboundMessage = SetMotorMessage | SetHeaterMessage | GetStateMessage;
```

---

## Implementation Notes

### Arduino Side

1. Use the `WebSocketsServer` library for Arduino
2. **Implement mDNS** - Advertise as `mcroaster.local` using mDNS/Bonjour for automatic discovery
3. Send `state` message on client connect
4. Send `temperature` message every 2 seconds (thermocouple)
5. Send `heaterSafety` message every 2 seconds (thermistor)
6. Send `motor` message immediately on state change
7. Send `heater` message immediately on state change
8. Implement safety cutoff: auto-disable heater if thermistor temp ≥ 210°C
9. Send `heaterSafety` with critical/emergency status when approaching limits
10. Keep JSON minimal to reduce memory usage
11. Handle `setMotor` and `setHeater` commands from frontend
12. **Auto-disable heater on WebSocket disconnect** - if client disconnects, immediately turn off heating element as a safety precaution

### Frontend Side

1. **Auto-discovery via mDNS** - Default to connecting to `ws://mcroaster.local:81`, with fallback to manual IP entry
2. Reconnect automatically on disconnect
3. Parse messages and update React state
4. Show connection status indicator
5. Buffer commands if disconnected
6. Implement heater control UI with safety warnings
7. Display heater state and power consumption
8. Show both thermocouple and thermistor temperatures
9. Alert user when heaterSafety status is warning/critical/emergency

**Note on Auto-Discovery**: Web browsers cannot directly perform mDNS queries for security reasons. However, most operating systems (macOS, iOS, Linux with Avahi, Windows with Bonjour) support mDNS hostname resolution. By advertising the Arduino as `mcroaster.local`, the frontend can simply connect to that hostname, and the OS will resolve it to the correct IP address automatically.

### Message Frequency

| Message Type | Frequency |
|--------------|-----------|
| `temperature` | Every 2 seconds (thermocouple) |
| `heaterSafety` | Every 2 seconds + on critical threshold |
| `motor` | On change only |
| `heater` | On change only |
| `state` | On connect + on request |
| `error` | On occurrence |

### Safety Considerations

1. **Temperature Limits**: 
   - Thermocouple: Monitor roasting temperature (0-250°C typical)
   - Thermistor: Monitor heating element (210°C hard limit, 215°C thermal fuse)
2. **Emergency Shutoff**: Heater auto-disables if:
   - Thermistor reads ≥ 210°C
   - Thermistor sensor fails or disconnects
   - Thermocouple sensor fails
   - **WebSocket client disconnects** (loss of frontend connection)
3. **Connection-Based Safety**: 
   - Heater requires active WebSocket connection to remain on
   - On disconnect, heater immediately turns off
   - Motor can continue running independently (mechanical safety)
   - Frontend must reconnect and explicitly re-enable heater
4. **Dual Temperature Monitoring**: 
   - Thermocouple: Bean/air temperature (control loop)
   - Thermistor: Heating element temperature (safety limit)
5. **Timeout**: Consider auto-shutoff if no frontend heartbeat for X seconds (30-60s recommended)
6. **Manual Override**: Physical emergency stop button recommended
7. **SSR Heat Dissipation**: Ensure adequate cooling/heat sinking for SSR
8. **Current Rating**: Use SSR rated for at least 1.5x expected load
9. **Watchdog Timer**: Implement watchdog to reset Arduino if it hangs
10. **Thermistor Placement**: Secure with high-temperature tape (Kapton) rated > 215°C
