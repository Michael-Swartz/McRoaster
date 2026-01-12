// Roaster states matching firmware enum (src/state.h)
export type RoasterState =
  | 'OFF'
  | 'FAN_ONLY'
  | 'PREHEAT'
  | 'ROASTING'
  | 'COOLING'
  | 'MANUAL'
  | 'ERROR';

// State IDs for numeric comparison (matches firmware RoasterState enum values)
export const STATE_IDS: Record<RoasterState, number> = {
  OFF: 0,
  FAN_ONLY: 1,
  PREHEAT: 2,
  ROASTING: 3,
  COOLING: 4,
  MANUAL: 5,
  ERROR: 6
};

// Error structure from firmware (websocket.cpp websocket_send_error)
export interface RoasterError {
  code: string;        // e.g., "OVER_TEMP_CHAMBER", "THERMOCOUPLE_FAULT"
  message: string;     // Human-readable description
  fatal: boolean;      // If true, requires acknowledgment
}

// Main state payload sent by firmware every loop (~1000ms per STATE_SEND_INTERVAL_MS)
// Matches websocket_send_state() in websocket.cpp
export interface RoasterStatePayload {
  state: RoasterState;
  stateId: number;
  chamberTemp: number | null;  // °C from thermocouple (null if NaN/fault)
  heaterTemp: number;          // °C from safety thermistor
  setpoint: number;            // Target temperature °C
  fanSpeed: number;            // 0-100 percent
  heaterPower: number;         // 0-100 percent (PID output or manual)
  heaterEnabled: boolean;      // Is heater actively controlled
  pidEnabled: boolean;         // Is PID active (false in MANUAL)
  roastTimeMs: number;         // Elapsed roast time in milliseconds
  firstCrackMarked: boolean;   // Has first crack been marked
  firstCrackTimeMs: number | null;  // When first crack was marked
  ror: number;                 // Rate of rise °C/min
  error: RoasterError | null;  // Current error if in ERROR state
}

// Event message for roast milestones (websocket_send_roast_event in websocket.cpp)
export interface RoastEventPayload {
  event: string;              // e.g., "FIRST_CRACK", "STATE_CHANGE"
  roastTimeMs: number;
  chamberTemp: number | null;
}

// Temperature data point for graphing
export interface TemperatureDataPoint {
  timeMs: number;
  chamberTemp: number;
  setpoint: number;
  ror: number;
}

// Inbound command types (frontend → firmware)
// Must match handleMessage() parsing in websocket.cpp
export type RoasterCommand =
  | { type: 'startPreheat'; payload: { targetTemp: number } }
  | { type: 'loadBeans'; payload: { setpoint: number } }
  | { type: 'endRoast'; payload: Record<string, never> }
  | { type: 'markFirstCrack'; payload: Record<string, never> }
  | { type: 'stop'; payload: Record<string, never> }
  | { type: 'enterFanOnly'; payload: { fanSpeed?: number } }
  | { type: 'exitFanOnly'; payload: Record<string, never> }
  | { type: 'enterManual'; payload: Record<string, never> }
  | { type: 'exitManual'; payload: Record<string, never> }
  | { type: 'clearFault'; payload: Record<string, never> }
  | { type: 'setSetpoint'; payload: { value: number } }
  | { type: 'setFanSpeed'; payload: { value: number } }
  | { type: 'setHeaterPower'; payload: { value: number } }
  | { type: 'getState'; payload: Record<string, never> }
  | { type: 'debugFan'; payload: Record<string, never> }
  | { type: 'testFanPins'; payload: Record<string, never> };

// Constants from firmware config.h for UI reference
export const ROASTER_CONSTANTS = {
  MAX_CHAMBER_TEMP: 260,        // °C - absolute max (triggers fault)
  WARN_CHAMBER_TEMP: 250,       // °C - warning threshold
  MAX_HEATER_TEMP: 210,         // °C - heater safety cutoff
  WARN_HEATER_TEMP: 190,        // °C - heater warning threshold
  MIN_FAN_WHEN_HEATING: 40,     // % - minimum fan when heater on
  COOLING_TARGET_TEMP: 50,      // °C - temp to end cooling
  FAN_MIN_DUTY: 0,              // % - minimum fan speed
  FAN_PREHEAT_DUTY: 60,         // % - fixed fan during preheat
  FAN_ROAST_MIN_DUTY: 30,       // % - minimum while roasting
  DEFAULT_PREHEAT_TEMP: 180,    // °C - default preheat target
  DEFAULT_ROAST_SETPOINT: 200,  // °C - default roast setpoint
  PREHEAT_TIMEOUT_MS: 900000,   // 15 minute preheat limit
} as const;
