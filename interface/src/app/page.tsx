'use client';

import { useState, useCallback, useEffect } from 'react';
import { ConnectionPanel } from '@/components/ConnectionPanel';
import { TemperatureGauge } from '@/components/TemperatureGauge';
import { HeaterSafetyGauge } from '@/components/HeaterSafetyGauge';
import { MotorControl } from '@/components/MotorControl';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { useArduinoWebSocket } from '@/hooks/useArduinoWebSocket';

export default function Home() {
  const [inputIp, setInputIp] = useState('');
  const [targetIp, setTargetIp] = useState<string | null>(null);

  const {
    temperature,
    heaterTemperature,
    heaterStatus,
    motorOn,
    connected,
    ip: deviceIp,
    firmware,
    error,
    autoDiscoveryStatus,
    setMotor,
    disconnect,
    tryAutoDiscover,
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

  const handleAutoDiscover = useCallback(async () => {
    const discoveredHost = await tryAutoDiscover();
    if (discoveredHost) {
      // Immediately set the IP and connect
      setInputIp(discoveredHost);
      setTargetIp(discoveredHost);
    }
  }, [tryAutoDiscover]);

  const handleToggleMotor = useCallback(() => {
    setMotor(!motorOn);
  }, [setMotor, motorOn]);

  // Auto-discover on page load
  useEffect(() => {
    handleAutoDiscover();
  }, []); // Empty dependency array = run once on mount

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
            onAutoDiscover={handleAutoDiscover}
            connected={connected}
            deviceIp={deviceIp}
            firmware={firmware}
            autoDiscoveryStatus={autoDiscoveryStatus}
          />

          <ErrorDisplay error={error} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TemperatureGauge temperature={temperature} connected={connected} />
            <HeaterSafetyGauge 
              temperature={heaterTemperature} 
              status={heaterStatus}
              connected={connected} 
            />
          </div>

          <div className="grid grid-cols-1 gap-6">
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
