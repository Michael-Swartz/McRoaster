# MCRoaster Architecture Design Document

## Overview

This document outlines the architecture for converting the MCRoaster project into a robust state-machine-based coffee roasting controller. The system controls a **fluid bed coffee roaster** with:

- **Blower Motor** (L298N driver) - Controls airflow through the roasting chamber
- **Heating Element** (SSR) - Controls heat input via PID
- **Thermocouple** (MAX31855) - Measures bean/chamber temperature
- **Thermistor** - Safety monitoring of heating element

### Reference Architecture

This design is inspired by the [esoren/roast](https://github.com/esoren/roast) project, adapted for WebSocket/React communication instead of a Nextion display.

---

## State Machine Design

### Operating States

The roaster operates in one of the following states:

| State | ID | Description | Fan | Heater |
|-------|-----|-------------|-----|--------|
| `OFF` | 0 | System idle, all outputs disabled | OFF | OFF |
| `PREHEAT` | 1 | Heating chamber before loading beans | ON (fixed) | PID to target |
| `ROASTING` | 2 | Active roasting with PID control | ON (variable) | PID to setpoint |
| `COOLING` | 3 | Post-roast cooling cycle | ON (max) | OFF |
| `MANUAL` | 4 | Direct control mode (no PID) | Manual | Manual PWM |
| `ERROR` | 5 | Fault condition, outputs disabled | OFF | OFF |

### State Transition Diagram

```
                    ┌──────────────────────────────────────────────┐
                    │                                              │
                    ▼                                              │
    ┌───────┐   START_PREHEAT   ┌──────────┐   LOAD_BEANS   ┌──────────┐
    │  OFF  │ ───────────────▶  │ PREHEAT  │ ─────────────▶ │ ROASTING │
    └───────┘                   └──────────┘                └──────────┘
        ▲                           │                            │
        │                           │ STOP                       │ FIRST_CRACK / END_ROAST
        │ STOP                      │                            │
        │                           ▼                            ▼
        │                       ┌───────┐                   ┌──────────┐
        └───────────────────────│ ERROR │◀── FAULT ────────│ COOLING  │
                                └───────┘                   └──────────┘
                                    ▲                            │
                                    │                            │ COOL_COMPLETE
        ┌────────┐                  │                            │
        │ MANUAL │──────────────────┴────────────────────────────┘
        └────────┘                                               │
            ▲                                                    │
            │ ENTER_MANUAL                                       │
            └────────────────────────────────────────────────────┘
                                    OFF
```

### State Transition Events

| Event | Description | Source |
|-------|-------------|--------|
| `STOP` | Stop roasting, return to OFF | UI button |
| `START_PREHEAT` | Begin preheat cycle | UI button |
| `LOAD_BEANS` | Beans loaded, start roasting | UI button |
| `END_ROAST` | Manual end of roast | UI button |
| `FIRST_CRACK` | First crack detected/marked | UI button |
| `COOL_COMPLETE` | Cooling finished (temp < 50°C) | Auto |
| `ENTER_MANUAL` | Switch to manual control | UI button |
| `EXIT_MANUAL` | Return from manual to OFF | UI button |
| `FAULT` | Error condition detected | System |
| `CLEAR_FAULT` | Clear error and return to OFF | UI button |

### State Behaviors

#### OFF State
- All outputs disabled
- System waits for START_PREHEAT or ENTER_MANUAL
- WebSocket sends periodic status updates

#### PREHEAT State
- Fan runs at fixed speed (e.g., 60%)
- Heater controlled by PID to reach target preheat temperature
- Transition to ROASTING when user signals beans are loaded
- Safety timeout after 15 minutes → ERROR

#### ROASTING State
- Full PID control of heater to maintain setpoint
- Fan speed adjustable (affects heat transfer rate)
- User can mark FIRST_CRACK for logging
- Timer tracks total roast time
- User ends roast manually or via profile

#### COOLING State
- Heater OFF
- Fan at maximum speed
- Automatic transition to OFF when temp < 50°C
- User can abort to OFF early

#### MANUAL State
- Direct control of fan speed (0-100%)
- Direct control of heater power (0-100%)
- No PID - user has full control
- All safety systems remain active
- Useful for testing and tuning

#### ERROR State
- All outputs disabled
- Error code and message stored
- Requires user acknowledgment to clear
- Auto-enters on any fault condition

---

## Module Architecture

### File Structure

```
src/
├── main.cpp              # Setup, main loop, WiFi/mDNS init
├── config.h              # Pin definitions, constants, PID tuning
├── state.h               # State enum, event enum, state machine interface
├── state.cpp             # State machine implementation
├── hardware.h            # Hardware abstraction interface
├── hardware.cpp          # Fan, heater, sensor control
├── pid_control.h         # PID controller interface
├── pid_control.cpp       # PID implementation
├── websocket.h           # WebSocket server interface
├── websocket.cpp         # WebSocket implementation
├── safety.h              # Safety system interface
├── safety.cpp            # Temperature limits, watchdogs
└── secrets.h             # WiFi credentials (gitignored)
```

### Module Responsibilities

#### config.h
```cpp
// Pin definitions
#define PIN_FAN_ENA     9     // PWM for fan speed
#define PIN_FAN_IN1     8     // Direction control
#define PIN_FAN_IN2     7     // Direction control
#define PIN_HEATER_SSR  6     // SSR control (PWM)
#define PIN_THERMO_CS   10    // MAX31855 chip select
#define PIN_THERMISTOR  A1    // Heater safety thermistor

// PID Tuning
#define PID_KP_AGGRESSIVE   120.0
#define PID_KI_AGGRESSIVE   30.0
#define PID_KD_AGGRESSIVE   60.0
#define PID_KP_CONSERVATIVE 70.0
#define PID_KI_CONSERVATIVE 15.0
#define PID_KD_CONSERVATIVE 10.0
#define PID_THRESHOLD       10.0  // °C from setpoint to switch tuning

// Safety limits
#define MAX_CHAMBER_TEMP    260.0  // °C - absolute max
#define MAX_HEATER_TEMP     210.0  // °C - heater safety cutoff
#define MIN_FAN_WHEN_HEATING 40    // % - minimum fan when heater on

// Timing
#define PREHEAT_TIMEOUT_MS  900000  // 15 minutes
#define COOLING_TARGET_TEMP 50.0    // °C to consider cooling complete
#define PID_WINDOW_SIZE     2000    // ms - PWM window for heater

// Fan limits
#define FAN_MIN_DUTY        30      // % - minimum while roasting
#define FAN_MAX_DUTY        100     // %
#define FAN_PREHEAT_DUTY    60      // % - during preheat
#define FAN_COOLING_DUTY    100     // % - during cooling
```

#### state.h / state.cpp
```cpp
// State enumeration
enum class RoasterState {
    OFF = 0,
    PREHEAT = 1,
    ROASTING = 2,
    COOLING = 3,
    MANUAL = 4,
    ERROR = 5
};

// Event enumeration
enum class RoasterEvent {
    NONE = 0,
    STOP,
    START_PREHEAT,
    LOAD_BEANS,
    END_ROAST,
    FIRST_CRACK,
    COOL_COMPLETE,
    ENTER_MANUAL,
    EXIT_MANUAL,
    FAULT,
    CLEAR_FAULT,
    SET_SETPOINT,
    SET_FAN_SPEED,
    SET_HEATER_POWER
};

// State machine interface
void state_init();
void state_update();  // Called every loop iteration
void state_handle_event(RoasterEvent event, float value = 0);
RoasterState state_get_current();
const char* state_get_name(RoasterState state);

// State data accessors
float state_get_setpoint();
float state_get_fan_speed();
float state_get_heater_power();
uint32_t state_get_roast_time_ms();
bool state_is_first_crack_marked();
```

#### hardware.h / hardware.cpp
```cpp
// Initialization
void hardware_init();

// Fan control
void fan_enable();
void fan_disable();
void fan_set_speed(uint8_t percent);  // 0-100
uint8_t fan_get_speed();

// Heater control
void heater_enable();
void heater_disable();
void heater_set_power(uint8_t percent);  // 0-100 (for manual mode)
void heater_set_pid_output(float output);  // 0-255 for PID
uint8_t heater_get_power();
bool heater_is_enabled();

// Temperature reading
float thermocouple_read();      // Returns °C or NAN on error
uint8_t thermocouple_get_fault();  // Fault code
float thermistor_read();        // Heater safety temp in °C

// Low-pass filtered readings
float thermocouple_read_filtered();
void thermocouple_reset_filter();
```

#### pid_control.h / pid_control.cpp
```cpp
// PID controller interface
void pid_init();
void pid_set_setpoint(float setpoint);
void pid_set_tunings(float kp, float ki, float kd);
void pid_set_aggressive_tunings();
void pid_set_conservative_tunings();
void pid_update(float current_temp);  // Call every loop
float pid_get_output();  // 0-255
void pid_reset();
void pid_enable();
void pid_disable();
bool pid_is_enabled();

// Auto-tuning selection based on error
void pid_auto_tune(float current_temp, float setpoint);
```

#### websocket.h / websocket.cpp
```cpp
// WebSocket server interface
void websocket_init();
void websocket_update();  // Handle connections, read messages
bool websocket_is_connected();
void websocket_send_state();  // Send full state update
void websocket_send_error(const char* code, const char* message);

// Message handling callback
typedef void (*WebSocketMessageHandler)(const char* type, JsonObject& payload);
void websocket_set_message_handler(WebSocketMessageHandler handler);
```

#### safety.h / safety.cpp
```cpp
// Safety system interface
void safety_init();
void safety_update();  // Call every loop
bool safety_is_ok();
const char* safety_get_fault_code();
const char* safety_get_fault_message();
void safety_clear_fault();

// Manual checks
bool safety_check_chamber_temp(float temp);
bool safety_check_heater_temp(float temp);
bool safety_check_fan_for_heater(uint8_t fan_percent, bool heater_on);
```

---

## WebSocket Protocol Updates

### New Message Types

#### Outbound (Arduino → Frontend)

##### Full State Message
```json
{
  "type": "roasterState",
  "timestamp": 1234567890,
  "payload": {
    "state": "ROASTING",
    "stateId": 2,
    "chamberTemp": 185.5,
    "heaterTemp": 145.2,
    "setpoint": 200.0,
    "fanSpeed": 70,
    "heaterPower": 85,
    "heaterEnabled": true,
    "pidEnabled": true,
    "roastTimeMs": 245000,
    "firstCrackMarked": false,
    "firstCrackTimeMs": null,
    "error": null
  }
}
```

##### Error Message
```json
{
  "type": "error",
  "timestamp": 1234567890,
  "payload": {
    "code": "OVER_TEMP",
    "message": "Chamber temperature exceeded 260°C",
    "fatal": true
  }
}
```

##### Roast Event Message
```json
{
  "type": "roastEvent",
  "timestamp": 1234567890,
  "payload": {
    "event": "FIRST_CRACK",
    "roastTimeMs": 480000,
    "chamberTemp": 196.5
  }
}
```

#### Inbound (Frontend → Arduino)

##### State Control Commands
```json
{ "type": "startPreheat", "payload": { "targetTemp": 180 } }
{ "type": "loadBeans", "payload": { "setpoint": 200 } }
{ "type": "endRoast", "payload": {} }
{ "type": "markFirstCrack", "payload": {} }
{ "type": "stop", "payload": {} }
{ "type": "enterManual", "payload": {} }
{ "type": "exitManual", "payload": {} }
{ "type": "clearFault", "payload": {} }
```

##### Parameter Control Commands
```json
{ "type": "setSetpoint", "payload": { "value": 205 } }
{ "type": "setFanSpeed", "payload": { "value": 75 } }
{ "type": "setHeaterPower", "payload": { "value": 80 } }  // Manual mode only
```

##### Query Commands
```json
{ "type": "getState", "payload": {} }
{ "type": "getConfig", "payload": {} }
```

---

## Frontend UI Design

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MCRoaster Coffee Controller                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ CONNECTION: ● Connected to mcroaster.local | Firmware: 1.0.0        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │         STATE: ROASTING         │  │        ROAST TIMER              │  │
│  │         ████████████████        │  │         07:45                   │  │
│  │                                 │  │    First Crack: 08:00 (est)     │  │
│  └─────────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     TEMPERATURE DISPLAY                               │  │
│  │  ┌─────────────────────┐          ┌─────────────────────┐            │  │
│  │  │    CHAMBER TEMP     │          │   SETPOINT          │            │  │
│  │  │      185.5°C        │    →     │    200°C            │            │  │
│  │  │   ▓▓▓▓▓▓▓▓▓▓░░░░   │          │  [−] [▓▓▓▓▓] [+]   │            │  │
│  │  └─────────────────────┘          └─────────────────────┘            │  │
│  │                                                                       │  │
│  │  ┌─────────────────────┐                                             │  │
│  │  │   HEATER SAFETY     │                                             │  │
│  │  │     145.2°C         │  Status: ● NORMAL                           │  │
│  │  │   ▓▓▓▓▓▓▓░░░░░░░   │  Limit: 210°C                               │  │
│  │  └─────────────────────┘                                             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        CONTROLS                                       │  │
│  │                                                                       │  │
│  │  FAN SPEED                          HEATER POWER (PID: ON)           │  │
│  │  ┌──────────────────────┐          ┌──────────────────────┐          │  │
│  │  │ [−] ════▓▓▓▓═══ [+] │  70%     │    ████████████░░░░  │  85%     │  │
│  │  └──────────────────────┘          └──────────────────────┘          │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         ACTIONS                                       │  │
│  │                                                                       │  │
│  │   [ ◉ MARK FIRST CRACK ]    [ ⏹ END ROAST ]    [ ⚠ EMERGENCY STOP ] │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     TEMPERATURE GRAPH                                 │  │
│  │   260°┤                                                               │  │
│  │   220°┤                              ╭────────────────                │  │
│  │   180°┤                     ╭───────╯                                 │  │
│  │   140°┤            ╭───────╯                                          │  │
│  │   100°┤     ╭─────╯                                                   │  │
│  │    60°┤────╯                                                          │  │
│  │       └──────────────────────────────────────────────────────────     │  │
│  │         0:00    2:00    4:00    6:00    8:00   10:00   12:00          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
App (page.tsx)
├── ConnectionPanel          # Existing - WiFi connection status
├── ErrorDisplay             # Existing - Error messages  
├── RoasterStatePanel        # NEW - Current state + timer
│   ├── StateBadge           # Visual state indicator
│   └── RoastTimer           # Elapsed time display
├── TemperaturePanel         # NEW - Combines temp displays
│   ├── ChamberTempGauge     # Renamed from TemperatureGauge
│   ├── SetpointControl      # NEW - Temp setpoint slider
│   └── HeaterSafetyGauge    # Existing
├── ControlPanel             # NEW - Fan & heater controls
│   ├── FanSpeedSlider       # NEW - Fan speed control
│   └── HeaterPowerDisplay   # NEW - Shows PID output (read-only in auto)
├── ActionPanel              # NEW - State transition buttons
│   ├── PreheatButton
│   ├── LoadBeansButton  
│   ├── MarkFirstCrackButton
│   ├── EndRoastButton
│   └── EmergencyStopButton
├── ManualModePanel          # NEW - Manual override controls
│   ├── ManualFanSlider
│   └── ManualHeaterSlider
└── TemperatureGraph         # NEW - Real-time chart
```

### New React Components

#### RoasterStatePanel.tsx
```tsx
interface RoasterStatePanelProps {
  state: RoasterState;
  roastTimeMs: number;
  firstCrackMarked: boolean;
  firstCrackTimeMs: number | null;
  connected: boolean;
}
```

#### SetpointControl.tsx
```tsx
interface SetpointControlProps {
  value: number;
  min: number;       // 100°C
  max: number;       // 250°C
  onChange: (value: number) => void;
  disabled: boolean;
  connected: boolean;
}
```

#### ControlSlider.tsx (Reusable)
```tsx
interface ControlSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;      // '%' or '°C'
  onChange: (value: number) => void;
  readOnly?: boolean;
  disabled?: boolean;
  colorScale?: 'blue' | 'red' | 'green';
}
```

#### ActionPanel.tsx
```tsx
interface ActionPanelProps {
  state: RoasterState;
  onStartPreheat: () => void;
  onLoadBeans: () => void;
  onMarkFirstCrack: () => void;
  onEndRoast: () => void;
  onStop: () => void;
  onEnterManual: () => void;
  onExitManual: () => void;
  onClearFault: () => void;
  connected: boolean;
}
```

#### TemperatureGraph.tsx
```tsx
interface TemperatureDataPoint {
  timeMs: number;
  chamberTemp: number;
  setpoint: number;
}

interface TemperatureGraphProps {
  data: TemperatureDataPoint[];
  firstCrackTimeMs: number | null;
  maxTimeMs: number;
  connected: boolean;
}
```

### Updated TypeScript Types

```typescript
// types/roaster.ts

export type RoasterState = 
  | 'OFF' 
  | 'PREHEAT' 
  | 'ROASTING' 
  | 'COOLING' 
  | 'MANUAL' 
  | 'ERROR';

export interface RoasterStatePayload {
  state: RoasterState;
  stateId: number;
  chamberTemp: number;
  heaterTemp: number;
  setpoint: number;
  fanSpeed: number;
  heaterPower: number;
  heaterEnabled: boolean;
  pidEnabled: boolean;
  roastTimeMs: number;
  firstCrackMarked: boolean;
  firstCrackTimeMs: number | null;
  error: RoasterError | null;
}

export interface RoasterError {
  code: string;
  message: string;
  fatal: boolean;
}

export interface RoastEventPayload {
  event: string;
  roastTimeMs: number;
  chamberTemp: number;
}

// Inbound commands
export interface StartPreheatCommand {
  type: 'startPreheat';
  payload: { targetTemp: number };
}

export interface LoadBeansCommand {
  type: 'loadBeans';
  payload: { setpoint: number };
}

export interface SetSetpointCommand {
  type: 'setSetpoint';
  payload: { value: number };
}

export interface SetFanSpeedCommand {
  type: 'setFanSpeed';
  payload: { value: number };
}

export interface SetHeaterPowerCommand {
  type: 'setHeaterPower';
  payload: { value: number };
}

export type RoasterCommand =
  | StartPreheatCommand
  | LoadBeansCommand
  | SetSetpointCommand
  | SetFanSpeedCommand
  | SetHeaterPowerCommand
  | { type: 'endRoast'; payload: {} }
  | { type: 'markFirstCrack'; payload: {} }
  | { type: 'stop'; payload: {} }
  | { type: 'enterManual'; payload: {} }
  | { type: 'exitManual'; payload: {} }
  | { type: 'clearFault'; payload: {} }
  | { type: 'getState'; payload: {} };
```

### Updated useArduinoWebSocket Hook

```typescript
// hooks/useArduinoWebSocket.ts additions

interface UseArduinoWebSocketReturn {
  // Existing
  connected: boolean;
  ip: string | null;
  firmware: string | null;
  error: string | null;
  autoDiscoveryStatus: string;
  disconnect: () => void;
  tryAutoDiscover: () => Promise<string | null>;
  
  // New state data
  roasterState: RoasterState;
  chamberTemp: number;
  heaterTemp: number;
  setpoint: number;
  fanSpeed: number;
  heaterPower: number;
  heaterEnabled: boolean;
  pidEnabled: boolean;
  roastTimeMs: number;
  firstCrackMarked: boolean;
  firstCrackTimeMs: number | null;
  roasterError: RoasterError | null;
  
  // Temperature history for graph
  tempHistory: TemperatureDataPoint[];
  
  // New commands
  startPreheat: (targetTemp: number) => void;
  loadBeans: (setpoint: number) => void;
  endRoast: () => void;
  markFirstCrack: () => void;
  stop: () => void;
  enterManual: () => void;
  exitManual: () => void;
  clearFault: () => void;
  setSetpoint: (value: number) => void;
  setFanSpeed: (value: number) => void;
  setHeaterPower: (value: number) => void;  // Manual mode only
}
```

---

## PID Control Strategy

### Overview

The PID controller manages heater output to maintain chamber temperature at the setpoint. Based on the esoren/roast approach:

### Dual-Tuning Strategy

**Aggressive Tuning** (far from setpoint, > 10°C):
- `Kp = 120.0` - Strong proportional response
- `Ki = 30.0` - Moderate integral to eliminate steady-state error
- `Kd = 60.0` - High derivative to prevent overshoot

**Conservative Tuning** (near setpoint, ≤ 10°C):
- `Kp = 70.0` - Gentler proportional response
- `Ki = 15.0` - Lower integral for stability
- `Kd = 10.0` - Reduced derivative to prevent oscillation

### PWM Window Approach

Since SSRs work best with relatively slow switching (to reduce EMI and extend relay life), we use a **time-proportioning** approach:

```cpp
// 2-second PWM window
#define PID_WINDOW_SIZE 2000  // ms

void heater_update() {
    if (!heater_enabled) {
        digitalWrite(PIN_HEATER_SSR, LOW);
        return;
    }
    
    // pid_output is 0-255 from PID library
    unsigned long windowTime = millis() % PID_WINDOW_SIZE;
    unsigned long onTime = map(pid_output, 0, 255, 0, PID_WINDOW_SIZE);
    
    if (windowTime < onTime) {
        digitalWrite(PIN_HEATER_SSR, HIGH);
    } else {
        digitalWrite(PIN_HEATER_SSR, LOW);
    }
}
```

### Temperature Filtering

Thermocouple readings can be noisy. Use an **exponential moving average** (low-pass filter):

```cpp
#define LPF_ALPHA 0.1  // Lower = smoother, slower response

float filtered_temp = 0;

float thermocouple_read_filtered() {
    float raw = thermocouple_read();
    if (isnan(raw)) return filtered_temp;  // Keep last good value
    
    filtered_temp = (LPF_ALPHA * raw) + ((1 - LPF_ALPHA) * filtered_temp);
    return filtered_temp;
}
```

### Rate of Rise (RoR) Calculation

For advanced roasting, calculate the rate of temperature change:

```cpp
#define ROR_SAMPLE_INTERVAL_MS 30000  // 30 seconds

float calculate_ror() {
    static float last_temp = 0;
    static uint32_t last_time = 0;
    
    float current_temp = thermocouple_read_filtered();
    uint32_t current_time = millis();
    
    if (current_time - last_time >= ROR_SAMPLE_INTERVAL_MS) {
        float delta_temp = current_temp - last_temp;
        float delta_minutes = (current_time - last_time) / 60000.0;
        float ror = delta_temp / delta_minutes;  // °C/min
        
        last_temp = current_temp;
        last_time = current_time;
        
        return ror;
    }
    
    return 0;  // Not enough time elapsed
}
```

---

## Safety Systems

### Multi-Layer Protection

1. **Chamber Over-Temperature**
   - Hard limit: 260°C
   - Soft warning: 250°C
   - Action: Disable heater, enter ERROR state

2. **Heater Safety Thermistor**
   - Hard limit: 210°C
   - Soft warning: 190°C
   - Action: Disable heater, enter ERROR state

3. **Minimum Fan When Heating**
   - Fan must be ≥40% when heater is enabled
   - Prevents element burnout and fire hazard
   - Auto-enforced by state machine

4. **Connection Watchdog**
   - If WebSocket disconnects for >5 seconds during ROASTING
   - Action: Enter COOLING state automatically
   - Prevents unattended heating

5. **Preheat Timeout**
   - Maximum 15 minutes in PREHEAT state
   - Action: Enter ERROR state
   - Prevents forgotten preheat

6. **Thermocouple Fault Detection**
   - Open circuit, short to GND, short to VCC
   - Action: Disable heater, enter ERROR state

### Safety Check Implementation

```cpp
void safety_update() {
    // Check chamber temperature
    float chamber = thermocouple_read_filtered();
    if (!isnan(chamber) && chamber > MAX_CHAMBER_TEMP) {
        safety_trigger_fault("OVER_TEMP_CHAMBER", 
            "Chamber temperature exceeded maximum");
        return;
    }
    
    // Check heater safety thermistor
    float heater = thermistor_read();
    if (heater > MAX_HEATER_TEMP) {
        safety_trigger_fault("OVER_TEMP_HEATER",
            "Heater temperature exceeded maximum");
        return;
    }
    
    // Check fan/heater interlock
    if (heater_is_enabled() && fan_get_speed() < MIN_FAN_WHEN_HEATING) {
        safety_trigger_fault("FAN_INTERLOCK",
            "Fan speed too low while heater enabled");
        return;
    }
    
    // Check thermocouple faults
    uint8_t fault = thermocouple_get_fault();
    if (fault != 0) {
        char msg[64];
        snprintf(msg, sizeof(msg), "Thermocouple fault: %s",
            fault & 0x01 ? "Open" : fault & 0x02 ? "Short to GND" : "Short to VCC");
        safety_trigger_fault("THERMOCOUPLE_FAULT", msg);
        return;
    }
}
```

---

## Implementation Plan

### Phase 1: Core State Machine (Arduino)

**Tasks:**
1. Create `config.h` with pin definitions and constants
2. Implement `hardware.cpp` - fan/heater/sensor abstraction
3. Implement `state.cpp` - state machine logic
4. Implement `safety.cpp` - safety monitoring
5. Update `main.cpp` to use new modules
6. Test state transitions with Serial debug

**Deliverables:**
- State machine that transitions correctly
- Hardware control working via state machine
- Safety systems active and tested

### Phase 2: PID Controller (Arduino)

**Tasks:**
1. Implement `pid_control.cpp` with dual-tuning
2. Integrate PID into PREHEAT and ROASTING states
3. Add temperature filtering
4. Test PID tuning with real heating element
5. Implement time-proportioning PWM for SSR

**Deliverables:**
- PID maintains temperature at setpoint
- Smooth transitions with dual-tuning
- Stable temperature control

### Phase 3: WebSocket Protocol Update (Arduino + Frontend)

**Tasks:**
1. Update `websocket.cpp` with new message types
2. Update TypeScript types in `types/roaster.ts`
3. Update `useArduinoWebSocket.ts` hook with new commands
4. Test message round-trip

**Deliverables:**
- Full state transmitted to frontend
- All commands working
- Reliable WebSocket communication

### Phase 4: Frontend UI (React)

**Tasks:**
1. Create `RoasterStatePanel` component
2. Create `SetpointControl` component
3. Create `ControlSlider` reusable component
4. Create `ActionPanel` component
5. Create `ManualModePanel` component
6. Update `page.tsx` with new layout
7. Style for dark theme consistency

**Deliverables:**
- Complete UI showing all roaster state
- All controls functional
- Responsive layout

### Phase 5: Temperature Graph

**Tasks:**
1. Add chart library (recharts or chart.js)
2. Create `TemperatureGraph` component
3. Implement temperature history tracking in hook
4. Add first crack marker on graph

**Deliverables:**
- Real-time temperature graph
- Shows setpoint line
- Shows first crack marker

### Phase 6: Polish & Testing

**Tasks:**
1. End-to-end testing of all states
2. Safety system testing
3. WebSocket stability testing
4. UI/UX refinements
5. Documentation updates

**Deliverables:**
- Stable, tested system
- Updated documentation
- Ready for real roasting

---

## Future Enhancements (Post-MVP)

1. **Auto Roast Profiles**
   - Stored temperature curves
   - Automatic state transitions
   - Profile editor UI

2. **Roast Logging**
   - Store completed roasts
   - Export to CSV
   - Roast comparison

3. **Rate of Rise Display**
   - Real-time RoR calculation
   - RoR graph overlay

4. **Sound Notifications**
   - First crack audio alert
   - End of roast notification

5. **Mobile Optimization**
   - Responsive design for phone
   - PWA for offline indicator

---

## Hardware Wiring Reference

```
Arduino R4 WiFi
┌─────────────────────────────────────┐
│                                     │
│  5V ────────────────────────────────┼──── 5V Supply (+)
│  GND ───────────────────────────────┼──── Common Ground
│                                     │
│  Pin 9 (PWM) ───────────────────────┼──── L298N ENA (Fan Speed)
│  Pin 8 ─────────────────────────────┼──── L298N IN1
│  Pin 7 ─────────────────────────────┼──── L298N IN2
│                                     │
│  Pin 6 (PWM) ───────────────────────┼──── SSR Control (+)
│  GND ───────────────────────────────┼──── SSR Control (−)
│                                     │
│  Pin 10 ────────────────────────────┼──── MAX31855 CS
│  Pin 11 (COPI) ─────────────────────┼──── MAX31855 DO
│  Pin 13 (SCK) ──────────────────────┼──── MAX31855 CLK
│  3.3V ──────────────────────────────┼──── MAX31855 VCC
│  GND ───────────────────────────────┼──── MAX31855 GND
│                                     │
│  Pin A1 ────────────────────────────┼──── Thermistor Divider
│                                     │
└─────────────────────────────────────┘

Thermistor Circuit:
3.3V ──┬── 100kΩ Thermistor ──┬── GND
       │                       │
       └─────── A1 ────────────┘
              10kΩ Pulldown

SSR Wiring:
Arduino Pin 6 ──── SSR Control (+)
GND ────────────── SSR Control (−)
AC Line ────────── SSR Load Terminal 1
Heating Element ── SSR Load Terminal 2
```

---

## Summary

This architecture provides:

- **Clean separation of concerns** with modular code files
- **Robust state machine** managing all roaster states
- **PID temperature control** with dual-tuning for optimal response
- **Multi-layer safety systems** protecting against all failure modes
- **WebSocket protocol** supporting full bidirectional communication
- **Modern React UI** with real-time feedback and intuitive controls
- **Incremental implementation plan** for manageable development

The design prioritizes **safety** and **reliability** while providing the flexibility for both manual operation and future automated roasting profiles.
