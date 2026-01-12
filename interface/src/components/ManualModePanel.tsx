'use client';

import { FanSpeedControl } from './FanSpeedControl';
import { HeaterPowerDisplay } from './HeaterPowerDisplay';

interface ManualModePanelProps {
  fanSpeed: number;
  heaterPower: number;
  heaterEnabled: boolean;
  onFanChange: (value: number) => void;
  onHeaterChange: (value: number) => void;
  onExit: () => void;
  visible: boolean;
  disabled: boolean;
}

export function ManualModePanel({
  fanSpeed,
  heaterPower,
  heaterEnabled,
  onFanChange,
  onHeaterChange,
  onExit,
  visible,
  disabled,
}: ManualModePanelProps) {
  if (!visible) return null;

  return (
    <div className="bg-yellow-900/20 border-2 border-yellow-600 rounded-lg p-6">
      {/* Warning banner */}
      <div className="bg-yellow-600 text-black font-bold text-center py-2 px-4 rounded-lg mb-6">
        ⚠️ MANUAL MODE - Direct control active
      </div>

      {/* Controls grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <FanSpeedControl
          value={fanSpeed}
          onChange={onFanChange}
          disabled={disabled}
          state="MANUAL"
          heaterEnabled={heaterEnabled}
        />
        
        <HeaterPowerDisplay
          heaterPower={heaterPower}
          pidEnabled={false}
          heaterEnabled={heaterEnabled}
          state="MANUAL"
          onManualChange={onHeaterChange}
          disabled={disabled}
        />
      </div>

      {/* Safety reminder */}
      <div className="flex items-center justify-between">
        <p className="text-yellow-400 text-sm">
          ℹ️ Safety systems remain active
        </p>
        
        <button
          onClick={onExit}
          disabled={disabled}
          className={`
            px-4 py-2 rounded-lg font-medium transition-colors
            ${disabled 
              ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed' 
              : 'bg-zinc-700 hover:bg-zinc-600 text-white'}
          `}
        >
          Exit Manual Mode
        </button>
      </div>
    </div>
  );
}
