'use client';

import type { RoasterState } from '@/types/roaster';

interface RoastTimerProps {
  roastTimeMs: number;
  firstCrackMarked: boolean;
  firstCrackTimeMs: number | null;
  state: RoasterState;
  connected: boolean;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// States that show the timer
const TIMED_STATES: RoasterState[] = ['PREHEAT', 'ROASTING', 'COOLING'];

export function RoastTimer({ 
  roastTimeMs, 
  firstCrackMarked, 
  firstCrackTimeMs, 
  state, 
  connected 
}: RoastTimerProps) {
  const showTimer = TIMED_STATES.includes(state);
  const isDisabled = !connected || !showTimer;

  return (
    <div className={`
      bg-zinc-800 border border-zinc-700 rounded-lg p-6
      ${isDisabled ? 'opacity-50' : ''}
    `}>
      <h3 className="text-zinc-400 text-sm font-medium text-center mb-2">
        Roast Time
      </h3>
      
      {/* Main timer display */}
      <div className="text-center">
        <span className={`
          text-4xl font-mono font-bold tracking-wider
          ${isDisabled ? 'text-zinc-500' : 'text-white'}
        `}>
          {showTimer ? formatTime(roastTimeMs) : '--:--'}
        </span>
      </div>
      
      {/* First crack marker */}
      {firstCrackMarked && firstCrackTimeMs !== null && (
        <div className="mt-3 text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-900/50 border border-yellow-600 rounded-full">
            <span className="text-yellow-400 text-sm font-medium">
              FC @ {formatTime(firstCrackTimeMs)}
            </span>
          </span>
        </div>
      )}
      
      {/* State hint when inactive */}
      {!showTimer && connected && (
        <p className="text-zinc-500 text-xs text-center mt-2">
          Timer starts during preheat
        </p>
      )}
    </div>
  );
}
