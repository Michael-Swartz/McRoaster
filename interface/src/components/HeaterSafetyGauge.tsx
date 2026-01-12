'use client';

import dynamic from 'next/dynamic';

const GaugeComponent = dynamic(() => import('react-gauge-component'), {
  ssr: false,
});

interface HeaterSafetyGaugeProps {
  temperature: number;
  connected: boolean;
}

export function HeaterSafetyGauge({ temperature, connected }: HeaterSafetyGaugeProps) {
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
      <h2 className="text-lg font-semibold text-zinc-200 mb-2 text-center">
        Heater Element Temperature
      </h2>
      
      <p className="text-zinc-400 text-xs text-center mb-4">
        Monitoring only - no safety limits enforced
      </p>

      <div className="flex justify-center">
        <GaugeComponent
          type="semicircle"
          arc={{
            width: 0.2,
            padding: 0.005,
            cornerRadius: 1,
            subArcs: [
              {
                limit: 100,
                color: '#3B82F6',  // Blue - cool
                showTick: true,
              },
              {
                limit: 150,
                color: '#5BE12C',  // Green - warm
                showTick: true,
              },
              {
                limit: 180,
                color: '#F5CD19',  // Yellow - hot
                showTick: true,
              },
              {
                limit: 200,
                color: '#F58B19',  // Orange - very hot
                showTick: true,
              },
              {
                limit: 250,
                color: '#EA4228',  // Red - extremely hot
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
                fontSize: '30px',
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
          Connect to see heater temperature
        </p>
      )}
    </div>
  );
}
