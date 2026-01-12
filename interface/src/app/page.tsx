'use client';

import { useState, useEffect, useRef } from 'react';
import { ConnectionPanel } from '@/components/ConnectionPanel';
import { TemperatureGauge } from '@/components/TemperatureGauge';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { RoasterStatePanel } from '@/components/RoasterStatePanel';
import { RoastTimer } from '@/components/RoastTimer';
import { SetpointControl } from '@/components/SetpointControl';
import { FanSpeedControl } from '@/components/FanSpeedControl';
import { HeaterPowerDisplay } from '@/components/HeaterPowerDisplay';
import { ActionPanel } from '@/components/ActionPanel';
import { ManualModePanel } from '@/components/ManualModePanel';
import { TemperatureGraph } from '@/components/TemperatureGraph';
import { RoastHistoryBrowser } from '@/components/RoastHistoryBrowser';
import { LogDisplay } from '@/components/LogDisplay';
import { useWebSerial } from '@/hooks/useWebSerial';
import { useRoastHistory } from '@/hooks/useRoastHistory';

export default function Home() {
  const [showHistory, setShowHistory] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const prevStateRef = useRef<string>('OFF');
  
  // Throttled temperature history for graph (updates at 1Hz)
  const [throttledTempHistory, setThrottledTempHistory] = useState<any[]>([]);
  const lastGraphUpdateRef = useRef<number>(0);

  const {
    // Connection state
    isConnected,
    isConnecting,
    portInfo,
    error,
    isSupported,
    firmware,

    // Connection actions
    connect,
    disconnect,
    requestPort,

    // Roaster state
    roasterState,
    chamberTemp,
    heaterTemp,
    setpoint,
    fanSpeed,
    heaterPower,
    heaterEnabled,
    pidEnabled,
    roastTimeMs,
    firstCrackMarked,
    firstCrackTimeMs,
    ror,
    roasterError,

    // Temperature history
    tempHistory,

    // Logs
    logs,
    clearLogs,

    // Commands
    startPreheat,
    loadBeans,
    endRoast,
    markFirstCrack,
    stop,
    enterFanOnly,
    exitFanOnly,
    enterManual,
    exitManual,
    clearFault,
    setSetpoint,
    setFanSpeed,
    setHeaterPower,
  } = useWebSerial();

  const {
    currentSession,
    isRecording,
    startNewRoast,
    endRoast: endRoastHistory,
    forceCompleteCurrentRoast,
    markFirstCrack: markFirstCrackHistory,
    addDataPoint,
    updateSetpoint,
    savedRoasts,
    deleteRoast,
    updateRoastNotes,
    updateRoastRating,
    exportRoast,
    clearAllRoasts,
    storageUsed,
    maxStorage,
  } = useRoastHistory();

  // Auto-start recording when transitioning to PREHEAT
  useEffect(() => {
    const prevState = prevStateRef.current;
    prevStateRef.current = roasterState;

    // Start recording when entering PREHEAT from OFF
    if (roasterState === 'PREHEAT' && prevState === 'OFF') {
      startNewRoast(setpoint);
    }

    // End recording when transitioning to OFF from COOLING
    if (roasterState === 'OFF' && prevState === 'COOLING') {
      endRoastHistory();
    }
  }, [roasterState, setpoint, startNewRoast, endRoastHistory]);

  // Track first crack in history
  useEffect(() => {
    if (firstCrackMarked && firstCrackTimeMs && isRecording) {
      markFirstCrackHistory(firstCrackTimeMs);
    }
  }, [firstCrackMarked, firstCrackTimeMs, isRecording, markFirstCrackHistory]);

  // Add data points to history during recording
  useEffect(() => {
    if (isRecording && isConnected && roasterState !== 'OFF' && roasterState !== 'ERROR') {
      addDataPoint(
        {
          chamberTemp: chamberTemp || null,
          heaterTemp,
          setpoint,
          ror,
          fanSpeed,
          heaterPower,
        },
        roastTimeMs
      );
    }
  }, [
    isRecording,
    isConnected,
    roasterState,
    chamberTemp,
    heaterTemp,
    setpoint,
    ror,
    fanSpeed,
    heaterPower,
    roastTimeMs,
    addDataPoint,
  ]);

  // Update setpoint in history
  useEffect(() => {
    if (isRecording) {
      updateSetpoint(setpoint);
    }
  }, [setpoint, isRecording, updateSetpoint]);

  // Throttle temperature graph updates to 1Hz (1000ms)
  useEffect(() => {
    const now = Date.now();
    if (now - lastGraphUpdateRef.current >= 1000) {
      setThrottledTempHistory(tempHistory);
      lastGraphUpdateRef.current = now;
    }
  }, [tempHistory]);

  return (
    <div className="min-h-screen bg-zinc-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header with History and Logs Buttons */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-zinc-100">
            MCRoaster
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className={`px-4 py-2 border rounded transition-colors flex items-center gap-2 ${
                showLogs 
                  ? 'bg-blue-800 border-blue-700 text-zinc-100' 
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              <span>📋</span>
              <span>Logs</span>
              {logs.length > 0 && (
                <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {logs.length}
                </span>
              )}
            </button>
            {currentSession && currentSession.endTime === null && (
              <button
                onClick={forceCompleteCurrentRoast}
                className="px-4 py-2 bg-orange-700 border border-orange-600 text-zinc-100 rounded hover:bg-orange-600 transition-colors flex items-center gap-2"
                title="Complete and save the incomplete roast session"
              >
                <span>💾</span>
                <span>Save Incomplete</span>
              </button>
            )}
            <button
              onClick={() => setShowHistory(true)}
              className="px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded hover:bg-zinc-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              History
              {savedRoasts.length > 0 && (
                <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {savedRoasts.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Log Display Panel (collapsible) */}
          {showLogs && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden" style={{ height: '300px' }}>
              <LogDisplay logs={logs} maxEntries={500} onClear={clearLogs} />
            </div>
          )}

          {/* Connection Panel */}
          <ConnectionPanel
            isConnected={isConnected}
            isConnecting={isConnecting}
            portInfo={portInfo}
            error={error}
            isSupported={isSupported}
            firmware={firmware}
            onConnect={connect}
            onDisconnect={disconnect}
            onRequestPort={requestPort}
          />

          {/* Error Display */}
          <ErrorDisplay error={error} roasterError={roasterError} />

          {/* State and Timer Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RoasterStatePanel
              state={roasterState}
              connected={isConnected}
            />
            <RoastTimer
              roastTimeMs={roastTimeMs}
              firstCrackMarked={firstCrackMarked}
              firstCrackTimeMs={firstCrackTimeMs}
              state={roasterState}
              connected={isConnected}
            />
          </div>

          {/* Temperature Gauges Row - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TemperatureGauge
              temperature={chamberTemp}
              connected={isConnected}
              ror={ror}
              type="chamber"
            />
            <TemperatureGauge
              temperature={heaterTemp}
              connected={isConnected}
              type="heater"
            />
          </div>

          {/* Setpoint Control */}
          <SetpointControl
            value={setpoint}
            chamberTemp={chamberTemp}
            onChange={setSetpoint}
            disabled={!isConnected}
            state={roasterState}
          />

          {/* Fan and Heater Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FanSpeedControl
              value={fanSpeed}
              onChange={setFanSpeed}
              disabled={!isConnected}
              state={roasterState}
              heaterEnabled={heaterEnabled}
            />
            <HeaterPowerDisplay
              heaterPower={heaterPower}
              pidEnabled={pidEnabled}
              heaterEnabled={heaterEnabled}
              state={roasterState}
              disabled={!isConnected}
            />
          </div>

          {/* Action Panel */}
          <ActionPanel
            state={roasterState}
            connected={isConnected}
            onStartPreheat={startPreheat}
            onLoadBeans={loadBeans}
            onMarkFirstCrack={markFirstCrack}
            onEndRoast={endRoast}
            onStop={stop}
            onEnterFanOnly={enterFanOnly}
            onExitFanOnly={exitFanOnly}
            onEnterManual={enterManual}
            onExitManual={exitManual}
            onClearFault={clearFault}
            firstCrackMarked={firstCrackMarked}
          />

          {/* Manual Mode Panel (only visible in MANUAL state) */}
          <ManualModePanel
            fanSpeed={fanSpeed}
            heaterPower={heaterPower}
            heaterEnabled={heaterEnabled}
            onFanChange={setFanSpeed}
            onHeaterChange={setHeaterPower}
            onExit={exitManual}
            visible={roasterState === 'MANUAL'}
            disabled={!isConnected}
          />

          {/* Temperature Graph */}
          <TemperatureGraph
            data={throttledTempHistory}
            firstCrackTimeMs={firstCrackTimeMs}
            setpoint={setpoint}
            connected={isConnected}
          />
        </div>
      </div>

      {/* Roast History Browser Modal */}
      <RoastHistoryBrowser
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        savedRoasts={savedRoasts}
        onDeleteRoast={deleteRoast}
        onUpdateNotes={updateRoastNotes}
        onUpdateRating={updateRoastRating}
        onExportRoast={exportRoast}
        onClearAll={clearAllRoasts}
        storageUsed={storageUsed}
        maxStorage={maxStorage}
      />
    </div>
  );
}
