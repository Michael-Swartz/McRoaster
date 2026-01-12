'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { TemperatureDataPoint } from '@/types/roaster';

// Dynamic import to avoid SSR issues
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

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

  const option = useMemo(() => {
    // Show last 60 seconds of data for auto-scrolling effect
    const windowSeconds = 60;
    const recentData = data.slice(-windowSeconds);
    
    // If we have no data or all times are 0, return early
    if (recentData.length === 0) {
      return null;
    }
    
    // Debug: log first and last timeMs values
    if (recentData.length > 0) {
      console.log('[TemperatureGraph] First timeMs:', recentData[0].timeMs, 'Last timeMs:', recentData[recentData.length - 1].timeMs);
    }
    
    const times = recentData.map(d => formatTime(d.timeMs));
    const chamberTemps = recentData.map(d => d.chamberTemp);
    const setpoints = recentData.map(d => d.setpoint);
    const rors = recentData.map(d => d.ror);

    return {
      backgroundColor: '#2d2d2d',
      grid: {
        left: '60px',
        right: '60px',
        top: '20px',
        bottom: '50px',
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(50, 50, 50, 0.9)',
        borderColor: '#666',
        textStyle: {
          color: '#fff',
        },
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: '#505050',
          },
        },
      },
      legend: {
        data: ['Chamber', 'Setpoint', 'RoR'],
        bottom: 0,
        textStyle: {
          color: '#888',
        },
      },
      xAxis: {
        type: 'category',
        data: times,
        axisLabel: {
          color: '#71717a',
          fontSize: 11,
          interval: 4, // Show every 5th second (0, 5, 10, 15...)
        },
        axisLine: {
          lineStyle: {
            color: '#404040',
          },
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: '#404040',
            type: 'dashed',
          },
        },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Temperature (°C)',
          min: 0,
          max: 260,
          nameTextStyle: {
            color: '#888',
            fontSize: 11,
          },
          axisLabel: {
            color: '#71717a',
            fontSize: 11,
          },
          axisLine: {
            lineStyle: {
              color: '#404040',
            },
          },
          splitLine: {
            lineStyle: {
              color: '#404040',
              type: 'dashed',
            },
          },
        },
        {
          type: 'value',
          name: 'RoR (°C/min)',
          min: 0,
          max: 20,
          nameTextStyle: {
            color: '#2ecc71',
            fontSize: 11,
          },
          axisLabel: {
            color: '#2ecc71',
            fontSize: 11,
          },
          axisLine: {
            lineStyle: {
              color: '#2ecc71',
            },
          },
          splitLine: {
            show: false,
          },
        },
      ],
      series: [
        {
          name: 'Chamber',
          type: 'line',
          data: chamberTemps,
          smooth: true,
          lineStyle: {
            color: '#ff6b35',
            width: 2,
          },
          itemStyle: {
            color: '#ff6b35',
          },
          showSymbol: false,
        },
        {
          name: 'Setpoint',
          type: 'line',
          data: setpoints,
          lineStyle: {
            color: '#4a9eff',
            width: 2,
            type: 'dashed',
          },
          itemStyle: {
            color: '#4a9eff',
          },
          showSymbol: false,
        },
        {
          name: 'RoR',
          type: 'line',
          yAxisIndex: 1,
          data: rors,
          smooth: true,
          lineStyle: {
            color: '#2ecc71',
            width: 2,
          },
          itemStyle: {
            color: '#2ecc71',
          },
          showSymbol: false,
        },
        ...(firstCrackTimeMs !== null ? [{
          name: 'First Crack',
          type: 'line',
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              color: '#f39c12',
              width: 2,
              type: 'dashed',
            },
            data: [
              {
                xAxis: formatTime(firstCrackTimeMs),
                label: {
                  formatter: 'FC',
                  color: '#f39c12',
                },
              },
            ],
          },
        }] : []),
      ],
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

      {hasData && option ? (
        <div className="h-[200px]">
          <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
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
