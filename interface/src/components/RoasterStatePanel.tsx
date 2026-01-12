'use client';

import type { RoasterState } from '@/types/roaster';

interface RoasterStatePanelProps {
  state: RoasterState;
  connected: boolean;
}

const STATE_COLORS: Record<RoasterState, string> = {
  OFF: 'bg-zinc-700',
  FAN_ONLY: 'bg-sky-600',
  PREHEAT: 'bg-blue-600',
  ROASTING: 'bg-green-600',
  COOLING: 'bg-cyan-600',
  MANUAL: 'bg-yellow-600',
  ERROR: 'bg-red-600',
};

const STATE_LABELS: Record<RoasterState, string> = {
  OFF: 'OFF',
  FAN_ONLY: 'FAN ONLY',
  PREHEAT: 'PREHEATING',
  ROASTING: 'ROASTING',
  COOLING: 'COOLING',
  MANUAL: 'MANUAL',
  ERROR: 'ERROR',
};

// States that show pulsing animation
const ACTIVE_STATES: RoasterState[] = ['FAN_ONLY', 'PREHEAT', 'ROASTING', 'COOLING'];

export function RoasterStatePanel({ state, connected }: RoasterStatePanelProps) {
  const isActive = ACTIVE_STATES.includes(state);
  const bgColor = connected ? STATE_COLORS[state] : 'bg-zinc-800';
  
  return (
    <div 
      className={`
        ${bgColor} 
        border border-zinc-700 rounded-lg p-6 
        transition-all duration-300
        ${!connected ? 'opacity-50' : ''}
      `}
    >
      <div className="flex items-center justify-center gap-3">
        {/* Status indicator dot */}
        <div className="relative">
          <div 
            className={`
              w-4 h-4 rounded-full
              ${connected ? (state === 'ERROR' ? 'bg-red-400' : 'bg-white') : 'bg-zinc-500'}
            `}
          />
          {connected && isActive && (
            <div 
              className="absolute inset-0 w-4 h-4 rounded-full bg-white animate-ping opacity-75"
            />
          )}
        </div>
        
        {/* State name */}
        <h2 className={`
          text-2xl font-bold tracking-wide
          ${connected ? 'text-white' : 'text-zinc-500'}
        `}>
          {connected ? STATE_LABELS[state] : 'DISCONNECTED'}
        </h2>
      </div>
      
      {/* Connection status hint */}
      {!connected && (
        <p className="text-zinc-500 text-sm text-center mt-2">
          Connect to view roaster state
        </p>
      )}
    </div>
  );
}
