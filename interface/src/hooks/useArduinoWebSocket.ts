'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { OutboundMessage, MotorPayload } from '@/types/websocket';

interface ArduinoState {
  temperature: number;
  motorOn: boolean;
  connected: boolean;
  ip: string | null;
  firmware: string | null;
  error: string | null;
}

export function useArduinoWebSocket(arduinoIp: string | null) {
  const [state, setState] = useState<ArduinoState>({
    temperature: 0,
    motorOn: false,
    connected: false,
    ip: null,
    firmware: null,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!arduinoIp) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = `ws://${arduinoIp}:81`;
    console.log('Connecting to:', wsUrl);

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setState(prev => ({ ...prev, connected: true, error: null }));
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setState(prev => ({ ...prev, connected: false }));

        // Attempt reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setState(prev => ({ ...prev, error: 'Connection error' }));
      };

      ws.onmessage = (event) => {
        try {
          const message: OutboundMessage = JSON.parse(event.data);
          console.log('Received:', message);

          switch (message.type) {
            case 'temperature':
              setState(prev => ({
                ...prev,
                temperature: message.payload.value,
              }));
              break;

            case 'motor':
              setState(prev => ({
                ...prev,
                motorOn: message.payload.on,
              }));
              break;

            case 'state':
              setState(prev => ({
                ...prev,
                temperature: message.payload.temperature.value,
                motorOn: message.payload.motor.on,
              }));
              break;

            case 'connected':
              setState(prev => ({
                ...prev,
                ip: message.payload.ip,
                firmware: message.payload.firmware,
              }));
              break;

            case 'error':
              setState(prev => ({
                ...prev,
                error: message.payload.message,
              }));
              break;
          }
        } catch (e) {
          console.error('Failed to parse message:', e);
        }
      };

      wsRef.current = ws;
    } catch (e) {
      console.error('Failed to connect:', e);
      setState(prev => ({ ...prev, error: 'Failed to connect' }));
    }
  }, [arduinoIp]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setState(prev => ({ ...prev, connected: false }));
  }, []);

  const sendMessage = useCallback((type: string, payload: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message = {
        type,
        timestamp: Date.now(),
        payload,
      };
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const setMotor = useCallback((on: boolean) => {
    const payload: MotorPayload = { on };
    sendMessage('setMotor', payload);
  }, [sendMessage]);

  const requestState = useCallback(() => {
    sendMessage('getState', {});
  }, [sendMessage]);

  useEffect(() => {
    if (arduinoIp) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [arduinoIp, connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    setMotor,
    requestState,
  };
}
