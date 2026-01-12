'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { RoasterState, RoasterError, RoasterStatePayload, TemperatureDataPoint } from '@/types/roaster';
import type { OutboundMessage, LogPayload } from '@/types/websocket';

// Maximum temperature history entries (30 min at ~1 sample/sec)
const MAX_TEMP_HISTORY = 1800;

// Maximum log entries to keep in memory
const MAX_LOG_HISTORY = 500;

// Default serial options
const DEFAULT_SERIAL_OPTIONS: SerialOptions = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none',
};

// Storage keys
const STORAGE_KEY_PORT = 'mcroaster_last_port';

export interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

export interface UseWebSerialReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  portInfo: SerialPortInfo | null;
  error: string | null;
  isSupported: boolean;

  // Connection management
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  requestPort: () => Promise<void>;

  // Roaster state (same as current useArduinoWebSocket)
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
  ror: number;
  roasterError: RoasterError | null;
  firmware: string | null;

  // Temperature history for graph
  tempHistory: TemperatureDataPoint[];

  // System logs
  logs: Array<LogPayload & { timestamp: number }>;
  clearLogs: () => void;

  // Roaster commands
  startPreheat: (targetTemp: number) => void;
  loadBeans: (setpoint: number) => void;
  endRoast: () => void;
  markFirstCrack: () => void;
  stop: () => void;
  enterFanOnly: (fanSpeed?: number) => void;
  exitFanOnly: () => void;
  enterManual: () => void;
  exitManual: () => void;
  clearFault: () => void;
  setSetpoint: (value: number) => void;
  setFanSpeed: (value: number) => void;
  setHeaterPower: (value: number) => void;
  requestState: () => void;

  // Debug commands
  debugFan: () => void;
  testFanPins: () => void;
}

export function useWebSerial(): UseWebSerialReturn {
  // Check for WebSerial API support
  const isSupported = typeof navigator !== 'undefined' && 'serial' in navigator;

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [portInfo, setPortInfo] = useState<SerialPortInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firmware, setFirmware] = useState<string | null>(null);

  // Roaster state
  const [roasterState, setRoasterState] = useState<RoasterState>('OFF');
  const [chamberTemp, setChamberTemp] = useState(0);
  const [heaterTemp, setHeaterTemp] = useState(0);
  const [setpoint, setSetpointState] = useState(0);
  const [fanSpeed, setFanSpeedState] = useState(0);
  const [heaterPower, setHeaterPowerState] = useState(0);
  const [heaterEnabled, setHeaterEnabled] = useState(false);
  const [pidEnabled, setPidEnabled] = useState(false);
  const [roastTimeMs, setRoastTimeMs] = useState(0);
  const [firstCrackMarked, setFirstCrackMarked] = useState(false);
  const [firstCrackTimeMs, setFirstCrackTimeMs] = useState<number | null>(null);
  const [ror, setRor] = useState(0);
  const [roasterError, setRoasterError] = useState<RoasterError | null>(null);

  // Temperature history
  const [tempHistory, setTempHistory] = useState<TemperatureDataPoint[]>([]);
  const tempHistoryRef = useRef<TemperatureDataPoint[]>([]);
  const prevStateRef = useRef<RoasterState>('OFF');

  // Log history
  const [logs, setLogs] = useState<Array<LogPayload & { timestamp: number }>>([]);

  // Serial port refs
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<string> | null>(null);
  const readableStreamClosedRef = useRef<Promise<void> | null>(null);
  const writableStreamClosedRef = useRef<Promise<void> | null>(null);
  const keepReadingRef = useRef(false);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Line buffer for NDJSON parsing
  const lineBufferRef = useRef('');

  // Send message helper
  const sendMessage = useCallback((type: string, payload: Record<string, unknown>) => {
    if (!writerRef.current) {
      console.error('[Serial] Cannot send - not connected');
      return;
    }

    const message = {
      type,
      timestamp: Date.now(),
      payload,
    };

    const data = JSON.stringify(message) + '\n';

    console.log('[Serial] Sending:', message);
    writerRef.current.write(data).catch((err) => {
      console.error('[Serial] Write error:', err);
    });
  }, []);

  // Handle incoming message
  const handleMessage = useCallback((line: string) => {
    try {
      const message = JSON.parse(line) as OutboundMessage;
      console.log('[Serial] Received:', message);

      if (message.type === 'roasterState') {
        const p = message.payload as RoasterStatePayload;

        // Track state transitions for history reset
        const prevState = prevStateRef.current;
        prevStateRef.current = p.state;

        // Clear history when transitioning to OFF from any active state
        if (p.state === 'OFF' && prevState !== 'OFF') {
          tempHistoryRef.current = [];
          setTempHistory([]);
        }

        // Update all state values
        setRoasterState(p.state);
        setChamberTemp(p.chamberTemp ?? 0);
        setHeaterTemp(p.heaterTemp);
        setSetpointState(p.setpoint);
        setFanSpeedState(p.fanSpeed);
        setHeaterPowerState(p.heaterPower);
        setHeaterEnabled(p.heaterEnabled);
        setPidEnabled(p.pidEnabled);
        setRoastTimeMs(p.roastTimeMs);
        setFirstCrackMarked(p.firstCrackMarked);
        setFirstCrackTimeMs(p.firstCrackTimeMs);
        setRor(p.ror);
        setRoasterError(p.error);

        // Add to temperature history during active states
        if (p.state !== 'OFF' && p.state !== 'ERROR' && p.chamberTemp !== null) {
          const dataPoint: TemperatureDataPoint = {
            timeMs: p.roastTimeMs,
            chamberTemp: p.chamberTemp,
            setpoint: p.setpoint,
            ror: p.ror,
          };

          tempHistoryRef.current.push(dataPoint);

          // Cap at MAX_TEMP_HISTORY entries
          if (tempHistoryRef.current.length > MAX_TEMP_HISTORY) {
            tempHistoryRef.current.shift();
          }

          // Update state (create new array for React reactivity)
          setTempHistory([...tempHistoryRef.current]);
        }
      } else if (message.type === 'connected') {
        // Handle connection confirmation with device info
        setFirmware(message.payload.firmware);
        setError(null);
        // Log connection event
        setLogs(prev => {
          const newLogs = [...prev, {
            level: 'info' as const,
            source: 'CONN',
            message: `Connected - Firmware: ${message.payload.firmware}`,
            timestamp: message.timestamp
          }];
          return newLogs.slice(-MAX_LOG_HISTORY);
        });
      } else if (message.type === 'error') {
        // Handle error messages
        setError(message.payload.message);
        setRoasterError(message.payload);
        // Log error event
        setLogs(prev => {
          const newLogs = [...prev, {
            level: 'error' as const,
            source: 'ERROR',
            message: `${message.payload.code}: ${message.payload.message}`,
            timestamp: message.timestamp
          }];
          return newLogs.slice(-MAX_LOG_HISTORY);
        });
      } else if (message.type === 'roastEvent') {
        // Log roast events
        const p = message.payload;
        setLogs(prev => {
          const newLogs = [...prev, {
            level: 'info' as const,
            source: 'EVENT',
            message: `${p.event} at ${Math.floor(p.roastTimeMs / 1000)}s (${p.chamberTemp?.toFixed(1) ?? 'N/A'}°C)`,
            timestamp: message.timestamp
          }];
          return newLogs.slice(-MAX_LOG_HISTORY);
        });
      } else if (message.type === 'roasterState') {
        // Log state updates (at debug level since they're frequent)
        const p = message.payload;
        setLogs(prev => {
          const newLogs = [...prev, {
            level: 'debug' as const,
            source: 'STATE',
            message: `${p.state} | Chamber: ${p.chamberTemp?.toFixed(1) ?? 'N/A'}°C | Heater: ${p.heaterTemp?.toFixed(1) ?? 'N/A'}°C | Fan: ${p.fanSpeed}% | Power: ${p.heaterPower}%`,
            timestamp: message.timestamp
          }];
          return newLogs.slice(-MAX_LOG_HISTORY);
        });
      } else if (message.type === 'log') {
        // Handle log messages
        setLogs(prev => {
          const newLogs = [...prev, { ...message.payload, timestamp: message.timestamp }];
          // Keep only the last MAX_LOG_HISTORY entries
          return newLogs.slice(-MAX_LOG_HISTORY);
        });
      }
    } catch (e) {
      console.error('[Serial] Failed to parse message:', line, e);
    }
  }, []);

  // Read loop for incoming data
  const readLoop = useCallback(async () => {
    if (!readerRef.current) return;

    try {
      while (keepReadingRef.current) {
        const { value, done } = await readerRef.current.read();

        if (done) {
          console.log('[Serial] Reader done');
          break;
        }

        if (value) {
          // Accumulate data and split by newlines
          lineBufferRef.current += value;
          const lines = lineBufferRef.current.split('\n');

          // Keep the last incomplete line in the buffer
          lineBufferRef.current = lines.pop() || '';

          // Process complete lines
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine) {
              handleMessage(trimmedLine);
            }
          }
        }
      }
    } catch (err) {
      console.error('[Serial] Read error:', err);
      if (keepReadingRef.current) {
        setError('Connection lost');
        setIsConnected(false);
      }
    }
  }, [handleMessage]);

  // Request a serial port from the user
  const requestPort = useCallback(async () => {
    if (!isSupported) {
      setError('WebSerial is not supported in this browser');
      return;
    }

    try {
      const port = await navigator.serial.requestPort();
      portRef.current = port;

      const info = port.getInfo();
      setPortInfo({
        usbVendorId: info.usbVendorId,
        usbProductId: info.usbProductId,
      });

      setError(null);
    } catch (err) {
      if ((err as Error).name === 'NotFoundError') {
        // User cancelled the port selection
        console.log('[Serial] Port selection cancelled');
      } else {
        console.error('[Serial] Failed to request port:', err);
        setError('Failed to select port');
      }
    }
  }, [isSupported]);

  // Connect to serial port
  const connect = useCallback(async () => {
    if (!isSupported) {
      setError('WebSerial is not supported in this browser');
      return;
    }

    // If no port selected, request one
    if (!portRef.current) {
      try {
        const ports = await navigator.serial.getPorts();
        if (ports.length > 0) {
          // Use first available port
          portRef.current = ports[0];
          const info = portRef.current.getInfo();
          setPortInfo({
            usbVendorId: info.usbVendorId,
            usbProductId: info.usbProductId,
          });
        } else {
          await requestPort();
          if (!portRef.current) {
            return; // User cancelled
          }
        }
      } catch (err) {
        console.error('[Serial] Failed to get ports:', err);
        setError('Failed to access serial ports');
        return;
      }
    }

    setIsConnecting(true);
    setError(null);

    try {
      await portRef.current.open(DEFAULT_SERIAL_OPTIONS);
      console.log('[Serial] Port opened');

      // Set up text decoder for reading
      const textDecoder = new TextDecoderStream();
      // Type assertion needed due to TypeScript lib type mismatch between Uint8Array and BufferSource
      readableStreamClosedRef.current = portRef.current.readable!.pipeTo(
        textDecoder.writable as WritableStream<Uint8Array>
      );
      readerRef.current = textDecoder.readable.getReader();

      // Set up writer
      const textEncoder = new TextEncoderStream();
      writableStreamClosedRef.current = textEncoder.readable.pipeTo(portRef.current.writable!);
      writerRef.current = textEncoder.writable.getWriter();

      // Start read loop
      keepReadingRef.current = true;
      readLoop();

      setIsConnected(true);
      setIsConnecting(false);

      // Request initial state
      setTimeout(() => {
        sendMessage('getState', {});
      }, 500);

      // Start keep-alive to prevent Arduino timeout (send every 3 seconds, timeout is 5)
      keepAliveIntervalRef.current = setInterval(() => {
        if (writerRef.current) {
          sendMessage('getState', {});
        }
      }, 3000);

      // Handle disconnect events
      portRef.current.addEventListener('disconnect', () => {
        console.log('[Serial] Port disconnected');
        setIsConnected(false);
        setError('Device disconnected');
        keepReadingRef.current = false;
      });
    } catch (err) {
      console.error('[Serial] Failed to connect:', err);
      setError(`Failed to connect: ${(err as Error).message}`);
      setIsConnecting(false);
    }
  }, [isSupported, requestPort, readLoop, sendMessage]);

  // Disconnect from serial port
  const disconnect = useCallback(async () => {
    keepReadingRef.current = false;

    // Clear keep-alive interval
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }

    try {
      // Close reader
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current = null;
      }

      // Wait for readable stream to close
      if (readableStreamClosedRef.current) {
        try {
          await readableStreamClosedRef.current;
        } catch {
          // Expected to throw on cancel
        }
        readableStreamClosedRef.current = null;
      }

      // Close writer
      if (writerRef.current) {
        await writerRef.current.close();
        writerRef.current = null;
      }

      // Wait for writable stream to close
      if (writableStreamClosedRef.current) {
        try {
          await writableStreamClosedRef.current;
        } catch {
          // Expected to throw on close
        }
        writableStreamClosedRef.current = null;
      }

      // Close port
      if (portRef.current) {
        await portRef.current.close();
        console.log('[Serial] Port closed');
      }
    } catch (err) {
      console.error('[Serial] Error during disconnect:', err);
    }

    setIsConnected(false);
    lineBufferRef.current = '';
  }, []);

  // Roaster commands - must match parseCommand() in serial_comm.cpp
  const startPreheat = useCallback((targetTemp: number) => {
    sendMessage('startPreheat', { targetTemp });
  }, [sendMessage]);

  const loadBeans = useCallback((setpointValue: number) => {
    sendMessage('loadBeans', { setpoint: setpointValue });
  }, [sendMessage]);

  const endRoast = useCallback(() => {
    sendMessage('endRoast', {});
  }, [sendMessage]);

  const markFirstCrack = useCallback(() => {
    sendMessage('markFirstCrack', {});
  }, [sendMessage]);

  const stop = useCallback(() => {
    sendMessage('stop', {});
  }, [sendMessage]);

  const enterFanOnly = useCallback((speed?: number) => {
    sendMessage('enterFanOnly', { fanSpeed: speed ?? 50 });
  }, [sendMessage]);

  const exitFanOnly = useCallback(() => {
    sendMessage('exitFanOnly', {});
  }, [sendMessage]);

  const enterManual = useCallback(() => {
    sendMessage('enterManual', {});
  }, [sendMessage]);

  const exitManual = useCallback(() => {
    sendMessage('exitManual', {});
  }, [sendMessage]);

  const clearFault = useCallback(() => {
    sendMessage('clearFault', {});
  }, [sendMessage]);

  const setSetpoint = useCallback((value: number) => {
    sendMessage('setSetpoint', { value });
  }, [sendMessage]);

  const setFanSpeed = useCallback((value: number) => {
    sendMessage('setFanSpeed', { value });
  }, [sendMessage]);

  const setHeaterPower = useCallback((value: number) => {
    sendMessage('setHeaterPower', { value });
  }, [sendMessage]);

  const requestState = useCallback(() => {
    sendMessage('getState', {});
  }, [sendMessage]);

  // Debug commands
  const debugFan = useCallback(() => {
    sendMessage('debugFan', {});
  }, [sendMessage]);

  const testFanPins = useCallback(() => {
    sendMessage('testFanPins', {});
  }, [sendMessage]);

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      keepReadingRef.current = false;
      disconnect();
    };
  }, [disconnect]);

  return {
    // Connection state
    isConnected,
    isConnecting,
    portInfo,
    error,
    isSupported,

    // Connection actions
    connect,
    disconnect,
    requestPort,

    // Roaster state
    roasterState,
    chamberTemp,
    heaterTemp,
    setpoint,
    fanSpeed,
    heaterPower,
    heaterEnabled,
    pidEnabled,
    roastTimeMs,
    firstCrackMarked,
    firstCrackTimeMs,
    ror,
    roasterError,
    firmware,

    // Temperature history
    tempHistory,

    // Logs
    logs,
    clearLogs,

    // Commands
    startPreheat,
    loadBeans,
    endRoast,
    markFirstCrack,
    stop,
    enterFanOnly,
    exitFanOnly,
    enterManual,
    exitManual,
    clearFault,
    setSetpoint,
    setFanSpeed,
    setHeaterPower,
    requestState,

    // Debug commands
    debugFan,
    testFanPins,
  };
}
