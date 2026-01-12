'use client';

import { useState, useEffect, useCallback } from 'react';
import type { RoasterState } from '@/types/roaster';
import { ROASTER_CONSTANTS } from '@/types/roaster';

interface FanSpeedControlProps {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  state: RoasterState;
  heaterEnabled?: boolean;
}

// States that allow fan speed changes
const EDITABLE_STATES: RoasterState[] = ['FAN_ONLY', 'PREHEAT', 'ROASTING', 'MANUAL'];

// Debounce delay in milliseconds
const DEBOUNCE_MS = 300;

export function FanSpeedControl({ 
  value, 
  onChange, 
  disabled, 
  state,
  heaterEnabled = false
}: FanSpeedControlProps) {
  const [localValue, setLocalValue] = useState(value);
  const canEdit = EDITABLE_STATES.includes(state) && !disabled;
  const minRequired = heaterEnabled ? ROASTER_CONSTANTS.MIN_FAN_WHEN_HEATING : 0;
  
  // Sync local value with prop when it changes externally
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounced onChange
  useEffect(() => {
    if (localValue === value) return;
    
    const timer = setTimeout(() => {
      onChange(localValue);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [localValue, value, onChange]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Math.round(Number(e.target.value) / 5) * 5; // Snap to 5% increments
    setLocalValue(newValue);
  }, []);

  const increment = useCallback(() => {
    if (!canEdit) return;
    setLocalValue(prev => Math.min(prev + 5, 100));
  }, [canEdit]);

  const decrement = useCallback(() => {
    if (!canEdit) return;
    setLocalValue(prev => Math.max(prev - 5, 0));
  }, [canEdit]);

  // Calculate fill percentage for visual display
  const fillPercent = (localValue / 100) * 100;
  const minRequiredPercent = (minRequired / 100) * 100;

  return (
    <div className={`
      bg-zinc-800 border border-zinc-700 rounded-lg p-4
      ${!canEdit ? 'opacity-50' : ''}
    `}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-zinc-400 text-sm font-medium">
          Fan Speed
        </h3>
        <span className="text-white text-xl font-bold">
          {localValue}%
        </span>
      </div>

      {/* Visual bar display */}
      <div className="relative h-4 bg-zinc-700 rounded-full mb-4 overflow-hidden">
        {/* Minimum required indicator */}
        {minRequired > 0 && (
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
            style={{ left: `${minRequiredPercent}%` }}
          />
        )}
        
        {/* Fill bar */}
        <div 
          className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-all duration-150"
          style={{ width: `${fillPercent}%` }}
        />
      </div>

      {/* Slider with +/- buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={decrement}
          disabled={!canEdit}
          className={`
            w-10 h-10 rounded-lg font-bold text-xl
            ${canEdit 
              ? 'bg-zinc-700 hover:bg-zinc-600 text-white' 
              : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}
            transition-colors
          `}
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
          disabled={!canEdit}
          className={`
            flex-1 h-2 rounded-lg appearance-none cursor-pointer
            ${canEdit ? 'bg-zinc-600' : 'bg-zinc-700 cursor-not-allowed'}
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-cyan-500
            [&::-webkit-slider-thumb]:cursor-pointer
          `}
        />
        
        <button
          onClick={increment}
          disabled={!canEdit}
          className={`
            w-10 h-10 rounded-lg font-bold text-xl
            ${canEdit 
              ? 'bg-zinc-700 hover:bg-zinc-600 text-white' 
              : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}
            transition-colors
          `}
        >
          +
        </button>
      </div>

      {/* Minimum warning */}
      {heaterEnabled && localValue < minRequired && (
        <p className="text-yellow-400 text-xs text-center mt-3">
          ⚠️ Minimum {minRequired}% required when heater is on
        </p>
      )}

      {/* State hint */}
      {!canEdit && state !== 'OFF' && (
        <p className="text-zinc-500 text-xs text-center mt-3">
          Fan control locked in {state} state
        </p>
      )}
    </div>
  );
}
