# WebSocket Message Schema

This document defines the WebSocket message schema for communication between the Arduino R4 WiFi and the Next.js web interface.

## Overview

- **Protocol**: WebSocket
- **Port**: 81 (default WebSocket port, HTTP remains on 80)
- **Message Format**: JSON
- **Encoding**: UTF-8

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
    }
  }
}
```

### `temperature`

Temperature-only update (sent every 2 seconds).

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

## Frontend to Arduino (Inbound Messages) - Future

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

interface MotorPayload {
  on: boolean;
  driverPowered: boolean;
}

interface StatePayload {
  temperature: TemperaturePayload;
  motor: MotorPayload;
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
type MotorMessage = WebSocketMessage<MotorPayload> & { type: 'motor' };
type StateMessage = WebSocketMessage<StatePayload> & { type: 'state' };
type ErrorMessage = WebSocketMessage<ErrorPayload> & { type: 'error' };
type ConnectedMessage = WebSocketMessage<ConnectedPayload> & { type: 'connected' };

type OutboundMessage =
  | TemperatureMessage
  | MotorMessage
  | StateMessage
  | ErrorMessage
  | ConnectedMessage;

// Inbound message types (Frontend -> Arduino)
type SetMotorMessage = WebSocketMessage<MotorPayload> & { type: 'setMotor' };
type GetStateMessage = WebSocketMessage<Record<string, never>> & { type: 'getState' };

type InboundMessage = SetMotorMessage | GetStateMessage;
```

---

## Implementation Notes

### Arduino Side

1. Use the `WebSocketsServer` library for Arduino
2. Send `state` message on client connect
3. Send `temperature` message every 2 seconds
4. Send `motor` message immediately on state change
5. Keep JSON minimal to reduce memory usage

### Frontend Side

1. Reconnect automatically on disconnect
2. Parse messages and update React state
3. Show connection status indicator
4. Buffer commands if disconnected

### Message Frequency

| Message Type | Frequency |
|--------------|-----------|
| `temperature` | Every 2 seconds |
| `motor` | On change only |
| `state` | On connect + on request |
| `error` | On occurrence |
