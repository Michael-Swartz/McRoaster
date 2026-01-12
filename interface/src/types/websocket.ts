import type { RoasterStatePayload, RoastEventPayload, RoasterError } from './roaster';

// Base message envelope
export interface WebSocketMessage<T = unknown> {
  type: string;
  timestamp: number;
  payload: T;
}

// ============== New Message Types (Firmware v2.0.0+) ==============

// Main state message sent by firmware every ~1000ms
export interface RoasterStateMessage {
  type: 'roasterState';
  timestamp: number;
  payload: RoasterStatePayload;
}

// Roast milestone events
export interface RoastEventMessage {
  type: 'roastEvent';
  timestamp: number;
  payload: RoastEventPayload;
}

// Error/fault notification
export interface RoasterErrorMessage {
  type: 'error';
  timestamp: number;
  payload: RoasterError;
}

// Connected confirmation with device info
export interface ConnectedPayload {
  ip: string;
  firmware: string;
}

export type ConnectedMessage = WebSocketMessage<ConnectedPayload> & { type: 'connected' };

// Log message for real-time debugging/monitoring
export interface LogPayload {
  level: 'debug' | 'info' | 'warn' | 'error';
  source: string;
  message: string;
}

export interface LogMessage {
  type: 'log';
  timestamp: number;
  payload: LogPayload;
}

// Union of all possible inbound messages from firmware
export type OutboundMessage =
  | RoasterStateMessage
  | RoastEventMessage
  | RoasterErrorMessage
  | ConnectedMessage
  | LogMessage;

// ============== Legacy Types (kept for reference) ==============

export interface TemperaturePayload {
  value: number;
  unit: 'C';
}

export interface HeaterSafetyPayload {
  temperature: number;
  unit: 'C';
  status: 'normal' | 'warning' | 'critical' | 'emergency';
}

export interface MotorPayload {
  on: boolean;
}

export interface StatePayload {
  temperature: TemperaturePayload;
  motor: MotorPayload;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

// ============== Command Types (Frontend -> Arduino) ==============

// All commands sent to firmware - must match handleMessage() in websocket.cpp
export type InboundMessage =
  | { type: 'startPreheat'; payload: { targetTemp: number } }
  | { type: 'loadBeans'; payload: { setpoint: number } }
  | { type: 'endRoast'; payload: Record<string, never> }
  | { type: 'markFirstCrack'; payload: Record<string, never> }
  | { type: 'stop'; payload: Record<string, never> }
  | { type: 'enterManual'; payload: Record<string, never> }
  | { type: 'exitManual'; payload: Record<string, never> }
  | { type: 'clearFault'; payload: Record<string, never> }
  | { type: 'setSetpoint'; payload: { value: number } }
  | { type: 'setFanSpeed'; payload: { value: number } }
  | { type: 'setHeaterPower'; payload: { value: number } }
  | { type: 'getState'; payload: Record<string, never> };
