'use client';

import dynamic from 'next/dynamic';

const GaugeComponent = dynamic(() => import('react-gauge-component'), {
  ssr: false,
});

interface HeaterSafetyGaugeProps {
  temperature: number;
  status: 'normal' | 'warning' | 'critical' | 'emergency';
  connected: boolean;
}

export function HeaterSafetyGauge({ temperature, status, connected }: HeaterSafetyGaugeProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'emergency':
        return 'text-red-500';
      case 'critical':
        return 'text-orange-500';
      case 'warning':
        return 'text-yellow-500';
      default:
        return 'text-green-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'emergency':
        return '🚨 EMERGENCY';
      case 'critical':
        return '⚠️ CRITICAL';
      case 'warning':
        return '⚠️ WARNING';
      default:
        return '✓ NORMAL';
    }
  };

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
      <h2 className="text-lg font-semibold text-zinc-200 mb-2 text-center">
        Heater Element Safety
      </h2>
      
      {connected && (
        <div className={`text-center font-bold mb-2 ${getStatusColor()}`}>
          {getStatusText()}
        </div>
      )}

      <div className="flex justify-center">
        <GaugeComponent
          type="semicircle"
          arc={{
            width: 0.2,
            padding: 0.005,
            cornerRadius: 1,
            subArcs: [
              {
                limit: 180,
                color: '#5BE12C',  // Green - normal operation
                showTick: true,
              },
              {
                limit: 200,
                color: '#F5CD19',  // Yellow - warning zone
                showTick: true,
              },
              {
                limit: 210,
                color: '#F58B19',  // Orange - critical zone
                showTick: true,
              },
              {
                limit: 220,
                color: '#EA4228',  // Red - emergency / thermal fuse zone
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
          maxValue={220}
        />
      </div>

      {!connected && (
        <p className="text-center text-zinc-500 text-sm mt-2">
          Connect to see heater temperature
        </p>
      )}

      {connected && temperature >= 180 && (
        <div className="mt-4 text-sm text-center">
          <p className="text-zinc-400">Thermal fuse rating: 215°C</p>
          <p className="text-zinc-400">Auto-shutoff: 210°C</p>
        </div>
      )}
    </div>
  );
}
