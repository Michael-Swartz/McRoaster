'use client';

import { useState, useCallback } from 'react';
import { ConnectionPanel } from '@/components/ConnectionPanel';
import { TemperatureGauge } from '@/components/TemperatureGauge';
import { MotorControl } from '@/components/MotorControl';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { useArduinoWebSocket } from '@/hooks/useArduinoWebSocket';

export default function Home() {
  const [inputIp, setInputIp] = useState('');
  const [targetIp, setTargetIp] = useState<string | null>(null);

  const {
    temperature,
    motorOn,
    connected,
    ip: deviceIp,
    firmware,
    error,
    setMotor,
    disconnect,
  } = useArduinoWebSocket(targetIp);

  const handleConnect = useCallback(() => {
    if (inputIp.trim()) {
      setTargetIp(inputIp.trim());
    }
  }, [inputIp]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    setTargetIp(null);
  }, [disconnect]);

  const handleToggleMotor = useCallback(() => {
    setMotor(!motorOn);
  }, [setMotor, motorOn]);

  return (
    <div className="min-h-screen bg-zinc-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-zinc-100 mb-8 text-center">
          Arduino Motor Controller
        </h1>

        <div className="space-y-6">
          <ConnectionPanel
            ip={inputIp}
            onIpChange={setInputIp}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            connected={connected}
            deviceIp={deviceIp}
            firmware={firmware}
          />

          <ErrorDisplay error={error} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TemperatureGauge temperature={temperature} connected={connected} />
            <MotorControl
              motorOn={motorOn}
              connected={connected}
              onToggle={handleToggleMotor}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
