'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { OutboundMessage, MotorPayload } from '@/types/websocket';

interface ArduinoState {
  temperature: number;
  heaterTemperature: number;
  heaterStatus: 'normal' | 'warning' | 'critical' | 'emergency';
  motorOn: boolean;
  connected: boolean;
  ip: string | null;
  firmware: string | null;
  error: string | null;
  autoDiscoveryStatus: 'idle' | 'discovering' | 'success' | 'failed';
}

export function useArduinoWebSocket(arduinoIp: string | null) {
  const [state, setState] = useState<ArduinoState>({
    temperature: 0,
    heaterTemperature: 0,
    heaterStatus: 'normal',
    motorOn: false,
    connected: false,
    ip: null,
    firmware: null,
    error: null,
    autoDiscoveryStatus: 'idle',
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

            case 'heaterSafety':
              setState(prev => ({
                ...prev,
                heaterTemperature: message.payload.temperature,
                heaterStatus: message.payload.status,
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
    console.log(`[WS] Attempting to send message: ${type}`, payload);
    
    if (!wsRef.current) {
      console.error('[WS] Cannot send - WebSocket not initialized');
      return;
    }
    
    console.log(`[WS] WebSocket readyState: ${wsRef.current.readyState} (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)`);
    
    if (wsRef.current.readyState === WebSocket.OPEN) {
      const message = {
        type,
        timestamp: Date.now(),
        payload,
      };
      const messageStr = JSON.stringify(message);
      console.log(`[WS] Sending:`, messageStr);
      try {
        wsRef.current.send(messageStr);
        console.log(`[WS] Message sent successfully`);
      } catch (error) {
        console.error('[WS] Error sending message:', error);
      }
    } else {
      console.error(`[WS] Cannot send - WebSocket not open (state: ${wsRef.current.readyState})`);
    }
  }, []);

  const setMotor = useCallback((on: boolean) => {
    const payload: MotorPayload = { on };
    sendMessage('setMotor', payload);
  }, [sendMessage]);

  const requestState = useCallback(() => {
    sendMessage('getState', {});
  }, [sendMessage]);

  const tryAutoDiscover = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      setState(prev => ({ ...prev, autoDiscoveryStatus: 'discovering' }));
      
      const mdnsHostname = 'mcroaster.local';
      const wsUrl = `ws://${mdnsHostname}:81`;
      
      console.log('Attempting auto-discovery:', wsUrl);
      
      try {
        const testWs = new WebSocket(wsUrl);
        
        const timeout = setTimeout(() => {
          if (testWs.readyState !== WebSocket.OPEN) {
            testWs.close();
            setState(prev => ({ ...prev, autoDiscoveryStatus: 'failed' }));
            console.log('Auto-discovery timed out');
            resolve(null);
          }
        }, 5000); // 5 second timeout
        
        testWs.onopen = () => {
          clearTimeout(timeout);
          testWs.close();
          setState(prev => ({ ...prev, autoDiscoveryStatus: 'success' }));
          console.log('Auto-discovery successful!');
          resolve(mdnsHostname);
        };
        
        testWs.onerror = () => {
          clearTimeout(timeout);
          setState(prev => ({ ...prev, autoDiscoveryStatus: 'failed' }));
          console.log('Auto-discovery failed');
          resolve(null);
        };
      } catch (e) {
        setState(prev => ({ ...prev, autoDiscoveryStatus: 'failed' }));
        console.error('Auto-discovery error:', e);
        resolve(null);
      }
    });
  }, []);

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
    tryAutoDiscover,
  };
}
