'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  RoastSession,
  RoastDataPoint,
} from '@/types/roastHistory';
import {
  STORAGE_KEYS,
  MAX_STORAGE_BYTES,
  generateRoastId,
} from '@/types/roastHistory';

export interface UseRoastHistoryReturn {
  // Current session
  currentSession: RoastSession | null;
  isRecording: boolean;

  // Session management
  startNewRoast: (preheatSetpoint?: number) => void;
  endRoast: () => void;
  markFirstCrack: (timeMs: number) => void;
  addDataPoint: (data: Omit<RoastDataPoint, 'time'>, roastTimeMs: number) => void;
  updateSetpoint: (setpoint: number) => void;

  // History management
  savedRoasts: RoastSession[];
  loadRoast: (id: string) => RoastSession | null;
  deleteRoast: (id: string) => void;
  updateRoastNotes: (id: string, notes: string) => void;
  updateRoastRating: (id: string, rating: number) => void;
  exportRoast: (id: string) => string | null;  // JSON export
  clearAllRoasts: () => void;

  // Storage stats
  storageUsed: number;           // bytes
  maxStorage: number;            // ~5MB typical
}

export function useRoastHistory(): UseRoastHistoryReturn {
  const [currentSession, setCurrentSession] = useState<RoastSession | null>(null);
  const [savedRoasts, setSavedRoasts] = useState<RoastSession[]>([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  // Ref to track current session for data point updates
  const currentSessionRef = useRef<RoastSession | null>(null);

  // Calculate storage usage
  const calculateStorageUsage = useCallback((): number => {
    try {
      let total = 0;
      for (const key in localStorage) {
        if (key.startsWith('mcroaster_')) {
          const value = localStorage.getItem(key);
          if (value) {
            total += key.length + value.length;
          }
        }
      }
      return total * 2; // UTF-16 encoding
    } catch {
      return 0;
    }
  }, []);

  // Load saved roasts from localStorage
  const loadSavedRoasts = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ROASTS);
      if (stored) {
        const roasts = JSON.parse(stored) as RoastSession[];
        setSavedRoasts(roasts.sort((a, b) => b.startTime - a.startTime));
      }
    } catch (e) {
      console.error('[RoastHistory] Failed to load saved roasts:', e);
    }
  }, []);

  // Load current session (for crash recovery)
  const loadCurrentSession = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CURRENT);
      if (stored) {
        const session = JSON.parse(stored) as RoastSession;
        setCurrentSession(session);
        currentSessionRef.current = session;
        setIsRecording(session.endTime === null);
      }
    } catch (e) {
      console.error('[RoastHistory] Failed to load current session:', e);
    }
  }, []);

  // Save current session to localStorage
  const saveCurrentSession = useCallback((session: RoastSession | null) => {
    try {
      if (session) {
        localStorage.setItem(STORAGE_KEYS.CURRENT, JSON.stringify(session));
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT);
      }
      setStorageUsed(calculateStorageUsage());
    } catch (e) {
      console.error('[RoastHistory] Failed to save current session:', e);
    }
  }, [calculateStorageUsage]);

  // Save all roasts to localStorage
  const saveRoasts = useCallback((roasts: RoastSession[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.ROASTS, JSON.stringify(roasts));
      setSavedRoasts(roasts.sort((a, b) => b.startTime - a.startTime));
      setStorageUsed(calculateStorageUsage());
    } catch (e) {
      console.error('[RoastHistory] Failed to save roasts:', e);
    }
  }, [calculateStorageUsage]);

  // Start a new roast session
  const startNewRoast = useCallback((preheatSetpoint: number = 180) => {
    const session: RoastSession = {
      id: generateRoastId(),
      startTime: Date.now(),
      endTime: null,
      preheatSetpoint,
      roastSetpoint: 200,
      firstCrackTime: null,
      totalRoastTime: 0,
      temperatureData: [],
      notes: '',
      rating: null,
    };

    setCurrentSession(session);
    currentSessionRef.current = session;
    setIsRecording(true);
    saveCurrentSession(session);

    console.log('[RoastHistory] Started new roast:', session.id);
  }, [saveCurrentSession]);

  // End current roast session
  const endRoast = useCallback(() => {
    if (!currentSessionRef.current) return;

    const session = {
      ...currentSessionRef.current,
      endTime: Date.now(),
      totalRoastTime: currentSessionRef.current.temperatureData.length > 0
        ? currentSessionRef.current.temperatureData[currentSessionRef.current.temperatureData.length - 1].time
        : 0,
    };

    // Add to saved roasts
    const updatedRoasts = [session, ...savedRoasts];
    saveRoasts(updatedRoasts);

    // Clear current session
    setCurrentSession(null);
    currentSessionRef.current = null;
    setIsRecording(false);
    saveCurrentSession(null);

    console.log('[RoastHistory] Ended roast:', session.id);
  }, [savedRoasts, saveRoasts, saveCurrentSession]);

  // Mark first crack
  const markFirstCrack = useCallback((timeMs: number) => {
    if (!currentSessionRef.current) return;

    const session = {
      ...currentSessionRef.current,
      firstCrackTime: timeMs,
    };

    setCurrentSession(session);
    currentSessionRef.current = session;
    saveCurrentSession(session);

    console.log('[RoastHistory] First crack marked at:', timeMs);
  }, [saveCurrentSession]);

  // Add data point to current session
  const addDataPoint = useCallback((data: Omit<RoastDataPoint, 'time'>, roastTimeMs: number) => {
    if (!currentSessionRef.current || !isRecording) return;

    const dataPoint: RoastDataPoint = {
      time: roastTimeMs,
      ...data,
    };

    const session = {
      ...currentSessionRef.current,
      temperatureData: [...currentSessionRef.current.temperatureData, dataPoint],
      totalRoastTime: roastTimeMs,
    };

    setCurrentSession(session);
    currentSessionRef.current = session;

    // Save periodically (every 10 data points) to avoid excessive writes
    if (session.temperatureData.length % 10 === 0) {
      saveCurrentSession(session);
    }
  }, [isRecording, saveCurrentSession]);

  // Update setpoint during roast
  const updateSetpoint = useCallback((setpoint: number) => {
    if (!currentSessionRef.current) return;

    const session = {
      ...currentSessionRef.current,
      roastSetpoint: setpoint,
    };

    setCurrentSession(session);
    currentSessionRef.current = session;
  }, []);

  // Load a saved roast by ID
  const loadRoast = useCallback((id: string): RoastSession | null => {
    return savedRoasts.find((r) => r.id === id) || null;
  }, [savedRoasts]);

  // Delete a saved roast
  const deleteRoast = useCallback((id: string) => {
    const updatedRoasts = savedRoasts.filter((r) => r.id !== id);
    saveRoasts(updatedRoasts);
    console.log('[RoastHistory] Deleted roast:', id);
  }, [savedRoasts, saveRoasts]);

  // Update notes for a saved roast
  const updateRoastNotes = useCallback((id: string, notes: string) => {
    const updatedRoasts = savedRoasts.map((r) =>
      r.id === id ? { ...r, notes } : r
    );
    saveRoasts(updatedRoasts);
  }, [savedRoasts, saveRoasts]);

  // Update rating for a saved roast
  const updateRoastRating = useCallback((id: string, rating: number) => {
    const updatedRoasts = savedRoasts.map((r) =>
      r.id === id ? { ...r, rating } : r
    );
    saveRoasts(updatedRoasts);
  }, [savedRoasts, saveRoasts]);

  // Export roast as JSON
  const exportRoast = useCallback((id: string): string | null => {
    const roast = savedRoasts.find((r) => r.id === id);
    if (!roast) return null;
    return JSON.stringify(roast, null, 2);
  }, [savedRoasts]);

  // Clear all saved roasts
  const clearAllRoasts = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.ROASTS);
      localStorage.removeItem(STORAGE_KEYS.CURRENT);
      setSavedRoasts([]);
      setCurrentSession(null);
      currentSessionRef.current = null;
      setIsRecording(false);
      setStorageUsed(calculateStorageUsage());
      console.log('[RoastHistory] Cleared all roasts');
    } catch (e) {
      console.error('[RoastHistory] Failed to clear roasts:', e);
    }
  }, [calculateStorageUsage]);

  // Initialize on mount
  useEffect(() => {
    loadSavedRoasts();
    loadCurrentSession();
    setStorageUsed(calculateStorageUsage());
  }, [loadSavedRoasts, loadCurrentSession, calculateStorageUsage]);

  return {
    // Current session
    currentSession,
    isRecording,

    // Session management
    startNewRoast,
    endRoast,
    markFirstCrack,
    addDataPoint,
    updateSetpoint,

    // History management
    savedRoasts,
    loadRoast,
    deleteRoast,
    updateRoastNotes,
    updateRoastRating,
    exportRoast,
    clearAllRoasts,

    // Storage stats
    storageUsed,
    maxStorage: MAX_STORAGE_BYTES,
  };
}
