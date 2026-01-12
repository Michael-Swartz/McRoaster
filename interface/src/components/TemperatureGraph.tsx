'use client';

import { useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { TemperatureDataPoint } from '@/types/roaster';

// Register AG Charts modules once on client side
if (typeof window !== 'undefined') {
  import('ag-charts-community').then(({ ModuleRegistry, AllCommunityModule }) => {
    ModuleRegistry.registerModules([AllCommunityModule]);
  });
}

// Dynamic import to avoid SSR issues with AG Charts
const AgCharts = dynamic(
  () => import('ag-charts-react').then((mod) => mod.AgCharts),
  { ssr: false }
);

interface TemperatureGraphProps {
  data: TemperatureDataPoint[];
  firstCrackTimeMs: number | null;
  setpoint: number;
  connected: boolean;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function TemperatureGraph({
  data,
  firstCrackTimeMs,
  setpoint: _setpoint,
  connected
}: TemperatureGraphProps) {
  const hasData = data.length > 0;

  // Memoize chart options to prevent unnecessary re-renders
  // Using explicit any type due to AG Charts complex generic types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartOptions: any = useMemo(() => {
    return {
      theme: 'ag-default-dark',
      background: {
        fill: '#2d2d2d',
      },
      padding: {
        top: 10,
        right: 10,
        bottom: 10,
        left: 10,
      },
      data: data,
      series: [
        {
          type: 'line' as const,
          xKey: 'timeMs',
          yKey: 'chamberTemp',
          yName: 'Chamber',
          stroke: '#ff6b35',
          strokeWidth: 2,
          marker: {
            enabled: false,
          },
        },
        {
          type: 'line' as const,
          xKey: 'timeMs',
          yKey: 'setpoint',
          yName: 'Setpoint',
          stroke: '#4a9eff',
          strokeWidth: 2,
          lineDash: [5, 5],
          marker: {
            enabled: false,
          },
        },
        {
          type: 'line' as const,
          xKey: 'timeMs',
          yKey: 'ror',
          yName: 'RoR',
          stroke: '#2ecc71',
          strokeWidth: 2,
          marker: {
            enabled: false,
          },
        },
      ],
      axes: [
        {
          type: 'number' as const,
          position: 'bottom' as const,
          title: {
            enabled: false,
          },
          label: {
            formatter: (params: { value: number }) => formatTime(params.value),
            color: '#71717a',
            fontSize: 11,
          },
          gridLine: {
            style: [{ stroke: '#404040', lineDash: [2, 2] }],
          },
          line: {
            color: '#404040',
          },
        },
        {
          type: 'number' as const,
          position: 'left' as const,
          keys: ['chamberTemp', 'setpoint'],
          title: {
            text: 'Temperature (C)',
            color: '#888888',
            fontSize: 11,
          },
          min: 0,
          max: 260,
          label: {
            formatter: (params: { value: number }) => `${params.value}`,
            color: '#71717a',
            fontSize: 11,
          },
          gridLine: {
            style: [{ stroke: '#404040', lineDash: [2, 2] }],
          },
          line: {
            color: '#404040',
          },
        },
        {
          type: 'number' as const,
          position: 'right' as const,
          keys: ['ror'],
          title: {
            text: 'RoR (C/min)',
            color: '#2ecc71',
            fontSize: 11,
          },
          min: 0,
          max: 20,
          label: {
            formatter: (params: { value: number }) => `${params.value}`,
            color: '#2ecc71',
            fontSize: 11,
          },
          gridLine: {
            enabled: false,
          },
          line: {
            color: '#2ecc71',
          },
        },
      ],
      legend: {
        position: 'bottom' as const,
        item: {
          label: {
            color: '#888888',
            fontSize: 11,
          },
          marker: {
            strokeWidth: 0,
          },
        },
      },
      tooltip: {
        enabled: true,
      },
    };
  }, [data, firstCrackTimeMs]);

  return (
    <div className={`
      bg-zinc-800 border border-zinc-700 rounded-lg p-4 beveled-panel
      ${!connected ? 'opacity-50' : ''}
    `}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-zinc-400 text-sm font-medium">
          Temperature History
        </h3>
        {hasData && (
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-orange-500" />
              <span className="text-zinc-400">Chamber</span>
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-blue-500" style={{ borderTop: '2px dashed #3b82f6', height: 0 }} />
              <span className="text-zinc-400">Setpoint</span>
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-green-500" />
              <span className="text-zinc-400">RoR</span>
            </span>
            {firstCrackTimeMs !== null && (
              <span className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-yellow-500" style={{ borderTop: '2px dashed #f39c12', height: 0 }} />
                <span className="text-zinc-400">FC</span>
              </span>
            )}
          </div>
        )}
      </div>

      {hasData ? (
        <div className="h-[200px]">
          <AgCharts options={chartOptions} />
        </div>
      ) : (
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-zinc-500 text-sm">
            {connected
              ? 'Temperature data will appear during roasting'
              : 'Connect to view temperature graph'}
          </p>
        </div>
      )}
    </div>
  );
}
