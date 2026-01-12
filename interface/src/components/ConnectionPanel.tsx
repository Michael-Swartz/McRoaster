'use client';

import { useState, useEffect } from 'react';
import { SerialSettings } from './SerialSettings';
import type { SerialPortInfo } from '@/hooks/useWebSerial';

interface ConnectionPanelProps {
  isConnected: boolean;
  isConnecting: boolean;
  portInfo: SerialPortInfo | null;
  error: string | null;
  isSupported: boolean;
  firmware: string | null;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onRequestPort: () => Promise<void>;
}

export function ConnectionPanel({
  isConnected,
  isConnecting,
  portInfo,
  error,
  isSupported,
  firmware,
  onConnect,
  onDisconnect,
  onRequestPort,
}: ConnectionPanelProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // If WebSerial not supported, show warning (only after mount to avoid hydration issues)
  if (mounted && !isSupported) {
    return (
      <div className="bg-zinc-800 border border-yellow-600 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-yellow-400 mb-2">Browser Not Supported</h2>
        <p className="text-zinc-400 text-sm">
          WebSerial API is not supported in this browser. Please use Chrome, Edge, or Opera
          on a desktop device. Make sure you are on HTTPS or localhost.
        </p>
      </div>
    );
  }

  const portLabel = portInfo
    ? `USB (${portInfo.usbVendorId?.toString(16) || '?'}:${portInfo.usbProductId?.toString(16) || '?'})`
    : 'No port';

  return (
    <>
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-200">Connection</h2>
          <button
            onClick={() => setShowSettings(true)}
            className="text-zinc-400 hover:text-zinc-100 transition-colors"
            title="Serial Settings"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* Quick Connection Area */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded text-zinc-400 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
              />
            </svg>
            <span>{isConnected ? portLabel : (portInfo ? portLabel : 'Select a port...')}</span>
          </div>
          {isConnected ? (
            <button
              onClick={onDisconnect}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded transition-colors"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-600 disabled:cursor-not-allowed text-white font-medium rounded transition-colors"
            >
              {isConnecting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Connecting...
                </span>
              ) : (
                'Connect'
              )}
            </button>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Status Row */}
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}
          />
          <span className="text-zinc-400 text-sm">
            {isConnected ? (
              <>
                Connected via USB Serial
                {firmware && <span className="text-zinc-500"> (v{firmware})</span>}
              </>
            ) : isConnecting ? (
              'Connecting...'
            ) : (
              'Disconnected'
            )}
          </span>
        </div>
      </div>

      {/* Settings Modal */}
      <SerialSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        portInfo={portInfo}
        isConnected={isConnected}
        onRequestPort={onRequestPort}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        error={error}
        isConnecting={isConnecting}
        firmware={firmware}
      />
    </>
  );
}
