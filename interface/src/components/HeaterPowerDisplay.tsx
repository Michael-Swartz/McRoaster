'use client';

import { useState, useEffect, useCallback } from 'react';
import type { RoasterState } from '@/types/roaster';

interface HeaterPowerDisplayProps {
  heaterPower: number;
  pidEnabled: boolean;
  heaterEnabled: boolean;
  state: RoasterState;
  onManualChange?: (value: number) => void;
  disabled: boolean;
}

// Debounce delay in milliseconds
const DEBOUNCE_MS = 300;

export function HeaterPowerDisplay({ 
  heaterPower, 
  pidEnabled, 
  heaterEnabled,
  state,
  onManualChange,
  disabled
}: HeaterPowerDisplayProps) {
  const [localValue, setLocalValue] = useState(heaterPower);
  const isManual = state === 'MANUAL' && onManualChange && !disabled;
  
  // Sync local value with prop when it changes externally
  useEffect(() => {
    setLocalValue(heaterPower);
  }, [heaterPower]);

  // Debounced onChange for manual mode
  useEffect(() => {
    if (!isManual || localValue === heaterPower) return;
    
    const timer = setTimeout(() => {
      onManualChange?.(localValue);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [localValue, heaterPower, onManualChange, isManual]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isManual) return;
    const newValue = Math.round(Number(e.target.value) / 5) * 5;
    setLocalValue(newValue);
  }, [isManual]);

  const increment = useCallback(() => {
    if (!isManual) return;
    setLocalValue(prev => Math.min(prev + 5, 100));
  }, [isManual]);

  const decrement = useCallback(() => {
    if (!isManual) return;
    setLocalValue(prev => Math.max(prev - 5, 0));
  }, [isManual]);

  // Get color based on power level
  const getBarColor = (power: number) => {
    if (power < 30) return 'from-orange-600 to-orange-500';
    if (power < 60) return 'from-orange-500 to-orange-400';
    if (power < 80) return 'from-orange-400 to-red-500';
    return 'from-red-500 to-red-400';
  };

  const displayValue = isManual ? localValue : heaterPower;
  const fillPercent = (displayValue / 100) * 100;

  return (
    <div className={`
      bg-zinc-800 border border-zinc-700 rounded-lg p-4
      ${disabled ? 'opacity-50' : ''}
    `}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-zinc-400 text-sm font-medium">
          Heater Power
        </h3>
        <div className="flex items-center gap-2">
          {/* Status badges */}
          {!heaterEnabled ? (
            <span className="px-2 py-0.5 text-xs font-medium bg-zinc-700 text-zinc-400 rounded">
              OFF
            </span>
          ) : pidEnabled ? (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-900/50 text-blue-400 border border-blue-600 rounded">
              PID
            </span>
          ) : (
            <span className="px-2 py-0.5 text-xs font-medium bg-yellow-900/50 text-yellow-400 border border-yellow-600 rounded">
              MANUAL
            </span>
          )}
          <span className="text-white text-xl font-bold">
            {displayValue}%
          </span>
        </div>
      </div>

      {/* Visual bar display */}
      <div className="relative h-6 bg-zinc-700 rounded-full mb-3 overflow-hidden">
        <div 
          className={`h-full bg-gradient-to-r ${getBarColor(displayValue)} rounded-full transition-all duration-150`}
          style={{ width: `${fillPercent}%` }}
        />
        
        {/* Power level indicators */}
        <div className="absolute inset-0 flex items-center justify-between px-2 text-xs text-zinc-400">
          <span className="opacity-50">0</span>
          <span className="opacity-50">50</span>
          <span className="opacity-50">100</span>
        </div>
      </div>

      {/* Manual control slider (only in MANUAL state) */}
      {isManual && (
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={decrement}
            className="w-10 h-10 rounded-lg font-bold text-xl bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
          >
            −
          </button>
          
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={localValue}
            onChange={handleChange}
            className="
              flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-zinc-600
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-5
              [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-orange-500
              [&::-webkit-slider-thumb]:cursor-pointer
            "
          />
          
          <button
            onClick={increment}
            className="w-10 h-10 rounded-lg font-bold text-xl bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
          >
            +
          </button>
        </div>
      )}

      {/* Info text */}
      {!heaterEnabled && (
        <p className="text-zinc-500 text-xs text-center mt-2">
          Heater disabled - safety system active
        </p>
      )}
    </div>
  );
}
