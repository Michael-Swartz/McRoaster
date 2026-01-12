'use client';

import { useState } from 'react';
import type { SerialPortInfo } from '@/hooks/useWebSerial';

interface SerialSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  portInfo: SerialPortInfo | null;
  isConnected: boolean;
  onRequestPort: () => Promise<void>;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  error: string | null;
  isConnecting: boolean;
  firmware: string | null;
}

export function SerialSettings({
  isOpen,
  onClose,
  portInfo,
  isConnected,
  onRequestPort,
  onConnect,
  onDisconnect,
  error,
  isConnecting,
  firmware,
}: SerialSettingsProps) {
  if (!isOpen) return null;

  const portLabel = portInfo
    ? `USB Device (${portInfo.usbVendorId?.toString(16) || 'unknown'}:${portInfo.usbProductId?.toString(16) || 'unknown'})`
    : 'No port selected';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-zinc-100">Serial Settings</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Connection Status */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-zinc-500'}`} />
            <span className="text-zinc-300">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {firmware && (
            <p className="text-zinc-500 text-sm">Firmware: {firmware}</p>
          )}
        </div>

        {/* Port Selection */}
        <div className="mb-6">
          <label className="block text-zinc-400 text-sm mb-2">Serial Port</label>
          <div className="flex gap-2">
            <div className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-zinc-300 text-sm">
              {portLabel}
            </div>
            <button
              onClick={onRequestPort}
              disabled={isConnected || isConnecting}
              className="px-4 py-2 bg-zinc-700 text-zinc-200 rounded hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Select
            </button>
          </div>
        </div>

        {/* Baud Rate (read-only for now) */}
        <div className="mb-6">
          <label className="block text-zinc-400 text-sm mb-2">Baud Rate</label>
          <div className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-zinc-300 text-sm">
            115200
          </div>
          <p className="text-zinc-500 text-xs mt-1">Fixed baud rate for MCRoaster</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-3 bg-red-900/30 border border-red-800 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Connect/Disconnect Button */}
        <div className="flex gap-2">
          {!isConnected ? (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="flex-1 py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? (
                <span className="flex items-center justify-center gap-2">
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
          ) : (
            <button
              onClick={onDisconnect}
              className="flex-1 py-3 bg-zinc-700 text-zinc-200 rounded font-medium hover:bg-zinc-600 transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>

        {/* Browser Compatibility Note */}
        <p className="text-zinc-500 text-xs mt-4 text-center">
          WebSerial requires Chrome, Edge, or Opera. HTTPS or localhost required.
        </p>
      </div>
    </div>
  );
}
