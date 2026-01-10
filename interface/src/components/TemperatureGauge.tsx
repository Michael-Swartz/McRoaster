'use client';

import dynamic from 'next/dynamic';

const GaugeComponent = dynamic(() => import('react-gauge-component'), {
  ssr: false,
});

interface TemperatureGaugeProps {
  temperature: number;
  connected: boolean;
}

export function TemperatureGauge({ temperature, connected }: TemperatureGaugeProps) {
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
      <h2 className="text-lg font-semibold text-zinc-200 mb-4 text-center">
        Temperature
      </h2>

      <div className="flex justify-center">
        <GaugeComponent
          type="semicircle"
          arc={{
            width: 0.2,
            padding: 0.005,
            cornerRadius: 1,
            subArcs: [
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
                color: '#F5CD19',  // Yellow - first crack zone (196-205°C)
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
            ],
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
                fontSize: '35px',
                fill: connected ? '#ffffff' : '#666666',
              },
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
          maxValue={250}
        />
      </div>

      {!connected && (
        <p className="text-center text-zinc-500 text-sm mt-2">
          Connect to see live temperature
        </p>
      )}
    </div>
  );
}
