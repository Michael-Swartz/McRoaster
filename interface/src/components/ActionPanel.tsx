'use client';

import { useState, useCallback } from 'react';
import type { RoasterState } from '@/types/roaster';
import { ROASTER_CONSTANTS } from '@/types/roaster';

interface ActionPanelProps {
  state: RoasterState;
  connected: boolean;
  onStartPreheat: (targetTemp: number) => void;
  onLoadBeans: (setpoint: number) => void;
  onMarkFirstCrack: () => void;
  onEndRoast: () => void;
  onStop: () => void;
  onEnterFanOnly: (fanSpeed?: number) => void;
  onExitFanOnly: () => void;
  onEnterManual: () => void;
  onExitManual: () => void;
  onClearFault: () => void;
  firstCrackMarked: boolean;
}

export function ActionPanel({
  state,
  connected,
  onStartPreheat,
  onLoadBeans,
  onMarkFirstCrack,
  onEndRoast,
  onStop,
  onEnterFanOnly,
  onExitFanOnly,
  onEnterManual,
  onExitManual,
  onClearFault,
  firstCrackMarked,
}: ActionPanelProps) {
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  const handleStartPreheat = useCallback(() => {
    onStartPreheat(ROASTER_CONSTANTS.DEFAULT_PREHEAT_TEMP);
  }, [onStartPreheat]);

  const handleLoadBeans = useCallback(() => {
    onLoadBeans(ROASTER_CONSTANTS.DEFAULT_ROAST_SETPOINT);
  }, [onLoadBeans]);

  const handleStop = useCallback(() => {
    setShowStopConfirm(true);
  }, []);

  const confirmStop = useCallback(() => {
    onStop();
    setShowStopConfirm(false);
  }, [onStop]);

  const cancelStop = useCallback(() => {
    setShowStopConfirm(false);
  }, []);

  // Stop confirmation modal
  if (showStopConfirm) {
    return (
      <div className="bg-zinc-800 border border-red-600 rounded-lg p-6">
        <div className="text-center">
          <h3 className="text-red-400 text-xl font-bold mb-4">
            ⚠️ Emergency Stop
          </h3>
          <p className="text-zinc-300 mb-6">
            Are you sure? This will immediately disable the heater.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={cancelStop}
              className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmStop}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-colors"
            >
              Yes, Stop Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render buttons based on state
  const renderButtons = () => {
    if (!connected) {
      return (
        <p className="text-zinc-500 text-center py-4">
          Connect to control roaster
        </p>
      );
    }

    switch (state) {
      case 'OFF':
        return (
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={() => onEnterFanOnly(50)}
              className="px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold text-lg transition-colors"
            >
              🌀 Start Fan Only
            </button>
            <button
              onClick={handleStartPreheat}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-lg transition-colors"
            >
              🔥 Start Preheat
            </button>
            <button
              onClick={onEnterManual}
              className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition-colors"
            >
              ⚙️ Enter Manual
            </button>
          </div>
        );

      case 'FAN_ONLY':
        return (
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={handleStartPreheat}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-lg transition-colors"
            >
              🔥 Start Preheat
            </button>
            <button
              onClick={onExitFanOnly}
              className="px-6 py-3 bg-sky-700 hover:bg-sky-600 text-white rounded-lg font-medium transition-colors"
            >
              ← Exit Fan Only
            </button>
            <button
              onClick={handleStop}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
            >
              ⏹️ Stop
            </button>
          </div>
        );

      case 'PREHEAT':
        return (
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={handleLoadBeans}
              className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold text-lg transition-colors"
            >
              ☕ Load Beans
            </button>
            <button
              onClick={handleStop}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
            >
              ⏹️ Stop
            </button>
          </div>
        );

      case 'ROASTING':
        return (
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={onMarkFirstCrack}
              disabled={firstCrackMarked}
              className={`
                px-6 py-3 rounded-lg font-bold text-lg transition-colors
                ${firstCrackMarked 
                  ? 'bg-yellow-900/30 text-yellow-600 cursor-not-allowed' 
                  : 'bg-yellow-600 hover:bg-yellow-500 text-white'}
              `}
            >
              {firstCrackMarked ? '✓ First Crack Marked' : '💥 Mark First Crack'}
            </button>
            <button
              onClick={onEndRoast}
              className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold text-lg transition-colors"
            >
              ✅ End Roast
            </button>
            <button
              onClick={handleStop}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
            >
              🛑 Emergency Stop
            </button>
          </div>
        );

      case 'COOLING':
        return (
          <div className="flex gap-4 justify-center flex-wrap">
            <div className="text-center">
              <span className="text-cyan-400 text-lg font-medium">
                🌀 Cooling in progress...
              </span>
              <p className="text-zinc-500 text-sm mt-1">
                Waiting for temperature to drop below {ROASTER_CONSTANTS.COOLING_TARGET_TEMP}°C
              </p>
            </div>
            <button
              onClick={handleStop}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
            >
              🛑 Emergency Stop
            </button>
          </div>
        );

      case 'MANUAL':
        return (
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={onExitManual}
              className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition-colors"
            >
              ← Exit Manual Mode
            </button>
            <button
              onClick={handleStop}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
            >
              🛑 Emergency Stop
            </button>
          </div>
        );

      case 'ERROR':
        return (
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={onClearFault}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-lg transition-colors"
            >
              🔄 Clear Fault
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
      <h3 className="text-zinc-400 text-sm font-medium text-center mb-4">
        Actions
      </h3>
      {renderButtons()}
    </div>
  );
}
