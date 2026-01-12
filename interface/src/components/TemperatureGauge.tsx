'use client';

import dynamic from 'next/dynamic';

const GaugeComponent = dynamic(() => import('react-gauge-component'), {
  ssr: false,
});

interface TemperatureGaugeProps {
  temperature: number;
  connected: boolean;
  ror?: number;  // Rate of rise C/min
  type?: 'chamber' | 'heater';
}

// Chamber temperature zones for coffee roasting
const chamberSubArcs = [
  {
    limit: 150,
    color: '#3B82F6',  // Blue - too cold / drying phase
    showTick: true,
  },
  {
    limit: 185,
    color: '#5BE12C',  // Green - Maillard / browning phase
    showTick: true,
  },
  {
    limit: 205,
    color: '#F5CD19',  // Yellow - first crack zone (196-205C)
    showTick: true,
  },
  {
    limit: 225,
    color: '#F58B19',  // Orange - development / second crack start
    showTick: true,
  },
  {
    limit: 250,
    color: '#EA4228',  // Red - danger / too hot
    showTick: true,
  },
];

// Heater temperature zones for safety monitoring
const heaterSubArcs = [
  {
    limit: 100,
    color: '#3B82F6',  // Blue - cool
    showTick: true,
  },
  {
    limit: 150,
    color: '#5BE12C',  // Green - normal
    showTick: true,
  },
  {
    limit: 180,
    color: '#F5CD19',  // Yellow - warm
    showTick: true,
  },
  {
    limit: 200,
    color: '#F58B19',  // Orange - warning
    showTick: true,
  },
  {
    limit: 220,
    color: '#EA4228',  // Red - danger
    showTick: true,
  },
];

export function TemperatureGauge({
  temperature,
  connected,
  ror,
  type = 'chamber'
}: TemperatureGaugeProps) {
  const isChamber = type === 'chamber';
  const title = isChamber ? 'Chamber Temperature' : 'Heater Temperature';
  const maxValue = isChamber ? 250 : 220;
  const subArcs = isChamber ? chamberSubArcs : heaterSubArcs;

  // Determine if temperature is in warning range
  const isWarning = isChamber ? temperature >= 225 : temperature >= 180;

  return (
    <div className={`
      bg-zinc-800 border border-zinc-700 rounded-lg p-6 beveled-panel
      ${isWarning && connected ? 'gauge-warning' : ''}
    `}>
      <h2 className="text-lg font-semibold text-zinc-200 mb-4 text-center">
        {title}
      </h2>

      <div className="flex justify-center">
        <GaugeComponent
          type="semicircle"
          arc={{
            width: 0.2,
            padding: 0.005,
            cornerRadius: 1,
            subArcs: subArcs,
          }}
          pointer={{
            color: '#ffffff',
            length: 0.8,
            width: 15,
          }}
          labels={{
            valueLabel: {
              formatTextValue: (value) => `${value}°C`,
              style: {
                fontSize: '30px',
                fill: connected ? '#ffffff' : '#666666',
                textShadow: '0px 0px 3px rgba(0,0,0,0.8)',
              },
              matchColorWithArc: false,
              hide: false,
            },
            tickLabels: {
              type: 'outer',
              defaultTickValueConfig: {
                formatTextValue: (value: number) => `${value}`,
                style: { fontSize: '10px', fill: '#999999' },
              },
            },
          }}
          value={connected ? temperature : 0}
          minValue={0}
          maxValue={maxValue}
        />
      </div>

      {/* Rate of Rise display - only for chamber */}
      {isChamber && connected && ror !== undefined && (
        <div className="text-center mt-2">
          <span className={`
            text-lg font-mono font-medium mono-display
            ${ror > 0 ? 'text-orange-400' : ror < 0 ? 'text-cyan-400' : 'text-zinc-400'}
          `}>
            {ror >= 0 ? '+' : ''}{ror.toFixed(1)} C/min
          </span>
          <p className="text-zinc-500 text-xs">Rate of Rise</p>
        </div>
      )}

      {!connected && (
        <p className="text-center text-zinc-500 text-sm mt-2">
          Connect to see live temperature
        </p>
      )}
    </div>
  );
}
