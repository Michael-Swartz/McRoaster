'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { RoastSession } from '@/types/roastHistory';

// Dynamic import to avoid SSR issues
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface RoastHistoryGraphProps {
  roast: RoastSession;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function RoastHistoryGraph({ roast }: RoastHistoryGraphProps) {
  const option = useMemo(() => {
    const data = roast.temperatureData;
    
    if (data.length === 0) {
      return null;
    }

    // Sample data for cleaner display
    const maxDataPoints = 40;
    const interval = Math.max(1, Math.floor(data.length / maxDataPoints));
    
    const times = data.map(d => formatTime(d.time));
    const chamberTemps = data.map(d => d.chamberTemp);
    const setpoints = data.map(d => d.setpoint);
    const rors = data.map(d => d.ror);

    // Find first crack marker position if exists
    const firstCrackIndex = roast.firstCrackTime 
      ? data.findIndex(d => d.time >= roast.firstCrackTime!)
      : -1;

    return {
      backgroundColor: 'transparent',
      grid: {
        left: '50px',
        right: '50px',
        top: '15px',
        bottom: '40px',
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(40, 40, 40, 0.95)',
        borderColor: '#666',
        textStyle: {
          color: '#fff',
          fontSize: 11,
        },
        formatter: (params: any) => {
          const time = params[0].axisValue;
          let tooltip = `<div style="font-weight: bold; margin-bottom: 4px;">${time}</div>`;
          params.forEach((param: any) => {
            // Handle scatter plot data (arrays) vs line data (numbers)
            const value = Array.isArray(param.value) ? param.value[1] : param.value;
            if (typeof value !== 'number') return; // Skip invalid data
            const unit = param.seriesName === 'RoR' ? '°C/min' : '°C';
            tooltip += `<div>${param.marker} ${param.seriesName}: <b>${value.toFixed(1)}${unit}</b></div>`;
          });
          return tooltip;
        },
      },
      legend: {
        data: ['Chamber', 'Setpoint', 'RoR'],
        bottom: 0,
        textStyle: {
          color: '#888',
          fontSize: 10,
        },
      },
      xAxis: {
        type: 'category',
        data: times,
        axisLabel: {
          color: '#71717a',
          fontSize: 10,
          interval: Math.max(0, Math.floor(data.length / 20)), // Show ~20 labels max
        },
        axisLine: {
          lineStyle: {
            color: '#404040',
          },
        },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Temp (°C)',
          min: 0,
          max: 260,
          nameTextStyle: {
            color: '#888',
            fontSize: 10,
          },
          axisLabel: {
            color: '#71717a',
            fontSize: 10,
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
          min: -20,
          max: 40,
          nameTextStyle: {
            color: '#888',
            fontSize: 10,
          },
          axisLabel: {
            color: '#71717a',
            fontSize: 10,
          },
          axisLine: {
            lineStyle: {
              color: '#404040',
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
          symbol: 'none',
          lineStyle: {
            color: '#3b82f6',
            width: 2,
          },
          yAxisIndex: 0,
        },
        {
          name: 'Setpoint',
          type: 'line',
          data: setpoints,
          smooth: false,
          symbol: 'none',
          lineStyle: {
            color: '#10b981',
            width: 1,
            type: 'dashed',
          },
          yAxisIndex: 0,
        },
        {
          name: 'RoR',
          type: 'line',
          data: rors,
          smooth: true,
          symbol: 'none',
          lineStyle: {
            color: '#f59e0b',
            width: 2,
          },
          yAxisIndex: 1,
        },
        // First crack marker
        ...(firstCrackIndex >= 0 ? [{
          name: 'First Crack',
          type: 'scatter',
          data: [[times[firstCrackIndex], chamberTemps[firstCrackIndex]]],
          symbol: 'pin',
          symbolSize: 40,
          itemStyle: {
            color: '#eab308',
          },
          label: {
            show: true,
            formatter: '1st',
            position: 'top',
            color: '#eab308',
            fontSize: 10,
            fontWeight: 'bold',
          },
          yAxisIndex: 0,
          z: 10,
        }] : []),
      ],
    };
  }, [roast]);

  if (!option) {
    return (
      <div className="h-64 flex items-center justify-center text-zinc-500 text-sm">
        No temperature data available
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded border border-zinc-700 p-2">
      <ReactECharts 
        option={option} 
        style={{ height: '280px', width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
}
