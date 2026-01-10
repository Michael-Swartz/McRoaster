// Base message envelope
export interface WebSocketMessage<T = unknown> {
  type: string;
  timestamp: number;
  payload: T;
}

// Payload types
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

export interface ConnectedPayload {
  ip: string;
  firmware: string;
}

// Outbound message types (Arduino -> Frontend)
export type TemperatureMessage = WebSocketMessage<TemperaturePayload> & { type: 'temperature' };
export type HeaterSafetyMessage = WebSocketMessage<HeaterSafetyPayload> & { type: 'heaterSafety' };
export type MotorMessage = WebSocketMessage<MotorPayload> & { type: 'motor' };
export type StateMessage = WebSocketMessage<StatePayload> & { type: 'state' };
export type ErrorMessage = WebSocketMessage<ErrorPayload> & { type: 'error' };
export type ConnectedMessage = WebSocketMessage<ConnectedPayload> & { type: 'connected' };

export type OutboundMessage =
  | TemperatureMessage
  | HeaterSafetyMessage
  | MotorMessage
  | StateMessage
  | ErrorMessage
  | ConnectedMessage;

// Inbound message types (Frontend -> Arduino)
export type SetMotorMessage = WebSocketMessage<MotorPayload> & { type: 'setMotor' };
export type GetStateMessage = WebSocketMessage<Record<string, never>> & { type: 'getState' };

export type InboundMessage = SetMotorMessage | GetStateMessage;
