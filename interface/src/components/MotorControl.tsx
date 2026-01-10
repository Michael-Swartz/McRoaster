'use client';

interface MotorControlProps {
  motorOn: boolean;
  connected: boolean;
  onToggle: () => void;
}

export function MotorControl({ motorOn, connected, onToggle }: MotorControlProps) {
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
      <h2 className="text-lg font-semibold text-zinc-200 mb-4 text-center">
        Motor Control
      </h2>

      {/* Industrial panel style */}
      <div className="bg-zinc-900 border-4 border-zinc-600 rounded-lg p-6 shadow-inner">
        {/* Status indicator lights */}
        <div className="flex justify-center gap-8 mb-6">
          <div className="flex flex-col items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full border-2 border-zinc-500 ${
                motorOn
                  ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.7)]'
                  : 'bg-zinc-700'
              }`}
            />
            <span className="text-xs text-zinc-400 uppercase tracking-wider">
              Run
            </span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full border-2 border-zinc-500 ${
                !motorOn
                  ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.7)]'
                  : 'bg-zinc-700'
              }`}
            />
            <span className="text-xs text-zinc-400 uppercase tracking-wider">
              Stop
            </span>
          </div>
        </div>

        {/* Main status display */}
        <div
          className={`text-center py-4 px-6 rounded border-2 mb-6 font-mono text-2xl font-bold tracking-widest ${
            motorOn
              ? 'bg-green-900/50 border-green-600 text-green-400'
              : 'bg-red-900/50 border-red-600 text-red-400'
          }`}
        >
          {motorOn ? 'MOTOR ON' : 'MOTOR OFF'}
        </div>

        {/* Control button */}
        <button
          onClick={onToggle}
          disabled={!connected}
          className={`w-full py-4 rounded-lg font-bold text-lg uppercase tracking-wider transition-all ${
            !connected
              ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
              : motorOn
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-red-600/30'
              : 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-green-600/30'
          }`}
        >
          {motorOn ? 'Stop Motor' : 'Start Motor'}
        </button>

        {!connected && (
          <p className="text-center text-zinc-500 text-sm mt-4">
            Connect to control motor
          </p>
        )}
      </div>
    </div>
  );
}
