'use client';

import { useEffect, useRef, useState } from 'react';
import type { LogPayload } from '@/types/websocket';

export interface LogEntry extends LogPayload {
  timestamp: number;
}

interface LogDisplayProps {
  logs: LogEntry[];
  maxEntries?: number;
  className?: string;
  onClear?: () => void;
}

const LOG_COLORS = {
  debug: 'text-gray-400',
  info: 'text-blue-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
} as const;

const LOG_BG_COLORS = {
  debug: 'bg-gray-900/30',
  info: 'bg-blue-900/30',
  warn: 'bg-yellow-900/30',
  error: 'bg-red-900/30',
} as const;

export function LogDisplay({ logs, maxEntries = 100, className = '', onClear }: LogDisplayProps) {
  const [filterLevel, setFilterLevel] = useState<'debug' | 'info' | 'warn' | 'error' | 'all'>('info');
  const logEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter logs based on level
  const filteredLogs = logs.slice(-maxEntries).filter(log => {
    if (filterLevel === 'all') return true;
    
    const levelHierarchy = { debug: 0, info: 1, warn: 2, error: 3 };
    return levelHierarchy[log.level] >= levelHierarchy[filterLevel];
  });

  // Format timestamp (avoiding hydration issues with locale-specific formatting)
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
  };

  // Clear logs
  const handleClear = () => {
    if (window.confirm('Clear all logs?')) {
      onClear?.();
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header with controls */}
      <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-200">System Logs</span>
          <span className="text-xs text-gray-400">({filteredLogs.length})</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Filter level selector */}
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value as typeof filterLevel)}
            className="text-xs bg-gray-700 text-gray-200 border border-gray-600 rounded px-2 py-1"
          >
            <option value="all">All</option>
            <option value="debug">Debug+</option>
            <option value="info">Info+</option>
            <option value="warn">Warn+</option>
            <option value="error">Error</option>
          </select>

          {/* Clear button */}
          <button
            onClick={handleClear}
            className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded hover:bg-gray-600"
            title="Clear logs"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Log entries */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-gray-900 p-2 font-mono text-xs"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-gray-500 text-center py-4">
            No logs to display
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div
              key={`${log.timestamp}-${index}`}
              className={`flex gap-2 py-1 px-2 mb-1 rounded ${LOG_BG_COLORS[log.level]}`}
            >
              {/* Timestamp */}
              <span className="text-gray-500 flex-shrink-0">
                {formatTime(log.timestamp)}
              </span>

              {/* Level badge */}
              <span className={`flex-shrink-0 w-12 text-center font-semibold ${LOG_COLORS[log.level]}`}>
                {log.level.toUpperCase()}
              </span>

              {/* Source */}
              <span className="text-gray-400 flex-shrink-0 w-16">
                [{log.source}]
              </span>

              {/* Message */}
              <span className="text-gray-200 flex-1 break-words">
                {log.message}
              </span>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
