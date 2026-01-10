'use client';

import { useState } from 'react';

interface ConnectionPanelProps {
  ip: string;
  onIpChange: (ip: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onAutoDiscover: () => void;
  connected: boolean;
  deviceIp: string | null;
  firmware: string | null;
  autoDiscoveryStatus: 'idle' | 'discovering' | 'success' | 'failed';
}

export function ConnectionPanel({
  ip,
  onIpChange,
  onConnect,
  onDisconnect,
  onAutoDiscover,
  connected,
  deviceIp,
  firmware,
  autoDiscoveryStatus,
}: ConnectionPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const getDiscoveryStatusColor = () => {
    switch (autoDiscoveryStatus) {
      case 'discovering':
        return 'text-blue-400';
      case 'success':
        return 'text-green-400';
      case 'failed':
        return 'text-yellow-400';
      default:
        return 'text-zinc-400';
    }
  };

  const getDiscoveryStatusText = () => {
    switch (autoDiscoveryStatus) {
      case 'discovering':
        return '🔍 Searching for mcroaster.local...';
      case 'success':
        return '✓ Found mcroaster.local';
      case 'failed':
        return '⚠ Auto-discovery failed - enter IP manually';
      default:
        return 'Click "Auto-Discover" to find your device';
    }
  };

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
      <h2 className="text-lg font-semibold text-zinc-200 mb-4">Connection</h2>

      {/* Auto-Discovery Section */}
      <div className="mb-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors mb-3"
        >
          <span className={`transform transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>
            ▶
          </span>
          Auto-Discovery
        </button>

        {showAdvanced && (
          <div className="ml-6 mb-4 space-y-3">
            <div className={`text-sm ${getDiscoveryStatusColor()}`}>
              {getDiscoveryStatusText()}
            </div>
            <button
              onClick={onAutoDiscover}
              disabled={connected || autoDiscoveryStatus === 'discovering'}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
            >
              {autoDiscoveryStatus === 'discovering' ? 'Searching...' : 'Auto-Discover'}
            </button>
          </div>
        )}
      </div>

      {/* Manual Connection */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={ip}
          onChange={(e) => onIpChange(e.target.value)}
          placeholder="Arduino IP (e.g., 192.168.1.100 or mcroaster.local)"
          className="flex-1 px-4 py-2 bg-zinc-900 border border-zinc-600 rounded text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          disabled={connected}
        />
        {connected ? (
          <button
            onClick={onDisconnect}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded transition-colors"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={!ip.trim()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white font-medium rounded transition-colors"
          >
            Connect
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div
          className={`w-3 h-3 rounded-full ${
            connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
          }`}
        />
        <span className="text-zinc-400 text-sm">
          {connected ? (
            <>
              Connected to {deviceIp}
              {firmware && <span className="text-zinc-500"> (v{firmware})</span>}
            </>
          ) : (
            'Disconnected'
          )}
        </span>
      </div>
    </div>
  );
}
