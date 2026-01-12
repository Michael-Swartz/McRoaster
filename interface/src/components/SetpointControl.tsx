'use client';

import { useState, useEffect, useCallback } from 'react';
import type { RoasterState } from '@/types/roaster';
import { ROASTER_CONSTANTS } from '@/types/roaster';

interface SetpointControlProps {
  value: number;
  chamberTemp: number;
  onChange: (value: number) => void;
  disabled: boolean;
  state: RoasterState;
}

// States that allow setpoint changes
const EDITABLE_STATES: RoasterState[] = ['PREHEAT', 'ROASTING', 'MANUAL'];

// Debounce delay in milliseconds
const DEBOUNCE_MS = 300;

export function SetpointControl({ 
  value, 
  chamberTemp, 
  onChange, 
  disabled, 
  state 
}: SetpointControlProps) {
  const [localValue, setLocalValue] = useState(value);
  const canEdit = EDITABLE_STATES.includes(state) && !disabled;
  
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
    const newValue = Math.round(Number(e.target.value) / 5) * 5; // Snap to 5°C increments
    setLocalValue(newValue);
  }, []);

  const increment = useCallback(() => {
    if (!canEdit) return;
    setLocalValue(prev => Math.min(prev + 5, ROASTER_CONSTANTS.MAX_CHAMBER_TEMP));
  }, [canEdit]);

  const decrement = useCallback(() => {
    if (!canEdit) return;
    setLocalValue(prev => Math.max(prev - 5, 100));
  }, [canEdit]);

  // Calculate delta from current temp
  const delta = localValue - chamberTemp;
  const deltaStr = delta >= 0 ? `+${delta.toFixed(0)}` : delta.toFixed(0);

  return (
    <div className={`
      bg-zinc-800 border border-zinc-700 rounded-lg p-4
      ${!canEdit ? 'opacity-50' : ''}
    `}>
      <h3 className="text-zinc-400 text-sm font-medium mb-3">
        Target Temperature
      </h3>

      {/* Temperature display */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <span className="text-zinc-400 text-lg">
          {chamberTemp.toFixed(0)}°C
        </span>
        <span className="text-zinc-500">→</span>
        <span className="text-white text-2xl font-bold">
          {localValue}°C
        </span>
        <span className={`
          text-sm font-medium ml-2
          ${delta > 0 ? 'text-orange-400' : delta < 0 ? 'text-cyan-400' : 'text-green-400'}
        `}>
          ({deltaStr}°C)
        </span>
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
          min={100}
          max={ROASTER_CONSTANTS.MAX_CHAMBER_TEMP}
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
            [&::-webkit-slider-thumb]:bg-orange-500
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

      {/* Min/Max labels */}
      <div className="flex justify-between text-xs text-zinc-500 mt-2 px-12">
        <span>100°C</span>
        <span>{ROASTER_CONSTANTS.MAX_CHAMBER_TEMP}°C</span>
      </div>

      {/* State hint */}
      {!canEdit && state !== 'OFF' && (
        <p className="text-zinc-500 text-xs text-center mt-3">
          Setpoint locked in {state} state
        </p>
      )}
    </div>
  );
}
