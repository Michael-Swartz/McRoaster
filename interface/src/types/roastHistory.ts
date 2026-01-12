// Roast session data stored in localStorage
export interface RoastSession {
  id: string;                    // UUID
  startTime: number;             // Unix timestamp
  endTime: number | null;        // Unix timestamp (null if ongoing)

  // Roast parameters
  preheatSetpoint: number;
  roastSetpoint: number;

  // Milestones
  firstCrackTime: number | null; // Relative to startTime (ms)
  totalRoastTime: number;        // ms

  // Data series
  temperatureData: RoastDataPoint[];

  // Metadata
  notes: string;
  rating: number | null;         // 1-5 stars
}

// Individual data point in a roast session
export interface RoastDataPoint {
  time: number;                  // Relative to startTime (ms)
  chamberTemp: number | null;
  heaterTemp: number;
  setpoint: number;
  ror: number;
  fanSpeed: number;
  heaterPower: number;
}

// Storage keys for localStorage
export const STORAGE_KEYS = {
  ROASTS: 'mcroaster_roasts',
  CURRENT: 'mcroaster_current',
  SETTINGS: 'mcroaster_settings',
} as const;

// Maximum storage size estimation (5MB typical for localStorage)
export const MAX_STORAGE_BYTES = 5 * 1024 * 1024;

// Utility to generate UUID
export function generateRoastId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Utility to format roast duration
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Utility to format date for display
export function formatRoastDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
