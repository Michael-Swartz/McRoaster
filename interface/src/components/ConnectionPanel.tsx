'use client';

interface ConnectionPanelProps {
  ip: string;
  onIpChange: (ip: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  connected: boolean;
  deviceIp: string | null;
  firmware: string | null;
}

export function ConnectionPanel({
  ip,
  onIpChange,
  onConnect,
  onDisconnect,
  connected,
  deviceIp,
  firmware,
}: ConnectionPanelProps) {
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
      <h2 className="text-lg font-semibold text-zinc-200 mb-4">Connection</h2>

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={ip}
          onChange={(e) => onIpChange(e.target.value)}
          placeholder="Arduino IP (e.g., 192.168.1.100)"
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
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition-colors"
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
