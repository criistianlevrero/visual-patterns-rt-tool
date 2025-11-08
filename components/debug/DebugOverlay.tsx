import React, { useState, useEffect, useRef } from 'react';
import { useTextureStore } from '../../store';

interface DebugMetrics {
  sequencerTicks: number;
  rafCalls: number;
  settingsUpdates: number;
  patternLoads: number;
  lastSequencerTime: number;
  lastRafTime: number;
  fps: number;
  sequencerStep: number;
  currentPatternId: string | null;
  animationFrameActive: boolean;
  transitionProgress: number;
  settingsHash: string;
}

const DebugOverlay: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [metrics, setMetrics] = useState<DebugMetrics>({
    sequencerTicks: 0,
    rafCalls: 0,
    settingsUpdates: 0,
    patternLoads: 0,
    lastSequencerTime: 0,
    lastRafTime: 0,
    fps: 0,
    sequencerStep: 0,
    currentPatternId: null,
    animationFrameActive: false,
    transitionProgress: 0,
    settingsHash: '',
  });
  
  const [logs, setLogs] = useState<Array<{ time: number; type: string; data: any }>>([]);
  const maxLogs = 100;
  const fpsFrames = useRef<number[]>([]);
  const lastFpsUpdate = useRef(Date.now());
  
  // Use refs to track previous values without causing re-renders
  const prevSettingsHashRef = useRef<string>('');
  const prevSequencerStepRef = useRef<number>(0);
  const prevAnimationActiveRef = useRef<boolean>(false);

  // Subscribe to store changes
  const storeState = useTextureStore((state) => ({
    currentSettings: state.currentSettings,
    sequencerCurrentStep: state.sequencerCurrentStep,
    selectedPatternId: state.selectedPatternId,
    animationFrameRef: state.animationFrameRef,
    transitionProgress: state.transitionProgress,
    isSequencerPlaying: state.project?.globalSettings.isSequencerPlaying,
  }));

  // Calculate settings hash for change detection
  const getSettingsHash = (settings: any) => {
    const str = JSON.stringify(settings);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  };

  // Track RAF calls
  useEffect(() => {
    let rafId: number;
    let frameCount = 0;
    
    const trackRaf = () => {
      frameCount++;
      const now = Date.now();
      fpsFrames.current.push(now);
      
      // Calculate FPS every 500ms
      if (now - lastFpsUpdate.current > 500) {
        const validFrames = fpsFrames.current.filter(t => now - t < 1000);
        const fps = validFrames.length;
        fpsFrames.current = validFrames;
        lastFpsUpdate.current = now;
        
        setMetrics(prev => ({
          ...prev,
          rafCalls: frameCount,
          lastRafTime: now,
          fps,
        }));
      }
      
      rafId = requestAnimationFrame(trackRaf);
    };
    
    rafId = requestAnimationFrame(trackRaf);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Track store changes - use refs to avoid circular dependencies
  useEffect(() => {
    const hash = getSettingsHash(storeState.currentSettings);
    const now = Date.now();
    
    const settingsChanged = prevSettingsHashRef.current !== hash;
    const stepChanged = prevSequencerStepRef.current !== storeState.sequencerCurrentStep;
    const animationActive = storeState.animationFrameRef !== null;
    const animationChanged = prevAnimationActiveRef.current !== animationActive;
    
    // Only update metrics if something actually changed
    if (settingsChanged || stepChanged || animationChanged) {
      setMetrics(prev => ({
        ...prev,
        settingsHash: hash,
        settingsUpdates: settingsChanged ? prev.settingsUpdates + 1 : prev.settingsUpdates,
        sequencerStep: storeState.sequencerCurrentStep,
        sequencerTicks: stepChanged ? prev.sequencerTicks + 1 : prev.sequencerTicks,
        lastSequencerTime: stepChanged ? now : prev.lastSequencerTime,
        currentPatternId: storeState.selectedPatternId,
        animationFrameActive: animationActive,
        transitionProgress: storeState.transitionProgress,
      }));
    }
    
    // Log significant events
    if (stepChanged) {
      addLog('sequencer', {
        step: storeState.sequencerCurrentStep,
        pattern: storeState.selectedPatternId,
        settingsHash: hash,
      });
    }
    
    if (animationActive && !prevAnimationActiveRef.current) {
      addLog('animation-start', { progress: storeState.transitionProgress });
    }
    
    if (!animationActive && prevAnimationActiveRef.current) {
      addLog('animation-end', { progress: storeState.transitionProgress });
    }
    
    // Update refs for next comparison
    prevSettingsHashRef.current = hash;
    prevSequencerStepRef.current = storeState.sequencerCurrentStep;
    prevAnimationActiveRef.current = animationActive;
  }, [storeState.currentSettings, storeState.sequencerCurrentStep, storeState.selectedPatternId, storeState.animationFrameRef, storeState.transitionProgress]);

  const addLog = (type: string, data: any) => {
    setLogs(prev => {
      const newLog = { time: Date.now(), type, data };
      const newLogs = [newLog, ...prev].slice(0, maxLogs);
      return newLogs;
    });
  };

  const clearLogs = () => {
    setLogs([]);
    setMetrics(prev => ({
      ...prev,
      sequencerTicks: 0,
      rafCalls: 0,
      settingsUpdates: 0,
      patternLoads: 0,
    }));
  };

  const exportDebugData = () => {
    const debugData = {
      metrics,
      logs: logs.slice(0, 50),
      timestamp: new Date().toISOString(),
      storeState: {
        ...storeState,
        currentSettings: getSettingsHash(storeState.currentSettings),
      },
    };
    
    const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full shadow-lg z-50"
        title="Abrir Debug Console"
      >
        🐛 Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-[80vh] bg-gray-900/95 backdrop-blur-sm border-2 border-purple-500 rounded-lg shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="bg-purple-600 px-4 py-2 flex justify-between items-center rounded-t-lg">
        <h3 className="font-bold text-white">🐛 Debug Console</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-white hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      {/* Metrics */}
      <div className="p-4 border-b border-gray-700 bg-gray-800/50">
        <h4 className="font-semibold text-cyan-400 mb-2">Métricas en Tiempo Real</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-gray-700/50 p-2 rounded">
            <div className="text-gray-400">FPS</div>
            <div className="text-white font-mono font-bold">{metrics.fps}</div>
          </div>
          <div className="bg-gray-700/50 p-2 rounded">
            <div className="text-gray-400">RAF Calls</div>
            <div className="text-white font-mono font-bold">{metrics.rafCalls}</div>
          </div>
          <div className="bg-gray-700/50 p-2 rounded">
            <div className="text-gray-400">Sequencer Ticks</div>
            <div className="text-white font-mono font-bold">{metrics.sequencerTicks}</div>
          </div>
          <div className="bg-gray-700/50 p-2 rounded">
            <div className="text-gray-400">Settings Updates</div>
            <div className="text-white font-mono font-bold">{metrics.settingsUpdates}</div>
          </div>
          <div className="bg-gray-700/50 p-2 rounded">
            <div className="text-gray-400">Current Step</div>
            <div className="text-white font-mono font-bold">{metrics.sequencerStep}</div>
          </div>
          <div className="bg-gray-700/50 p-2 rounded">
            <div className="text-gray-400">Animation Active</div>
            <div className={`font-mono font-bold ${metrics.animationFrameActive ? 'text-green-400' : 'text-red-400'}`}>
              {metrics.animationFrameActive ? 'YES' : 'NO'}
            </div>
          </div>
          <div className="bg-gray-700/50 p-2 rounded col-span-2">
            <div className="text-gray-400">Transition Progress</div>
            <div className="text-white font-mono font-bold">{(metrics.transitionProgress * 100).toFixed(1)}%</div>
            <div className="w-full bg-gray-600 rounded-full h-1.5 mt-1">
              <div 
                className="bg-cyan-500 h-1.5 rounded-full transition-all" 
                style={{ width: `${metrics.transitionProgress * 100}%` }}
              />
            </div>
          </div>
          <div className="bg-gray-700/50 p-2 rounded col-span-2">
            <div className="text-gray-400">Settings Hash</div>
            <div className="text-cyan-300 font-mono text-xs truncate">{metrics.settingsHash}</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-2 border-b border-gray-700 flex gap-2">
        <button
          onClick={clearLogs}
          className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-semibold py-1 px-2 rounded"
        >
          Clear Logs
        </button>
        <button
          onClick={exportDebugData}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1 px-2 rounded"
        >
          Export Data
        </button>
      </div>

      {/* Event Logs */}
      <div className="flex-1 overflow-y-auto p-4">
        <h4 className="font-semibold text-cyan-400 mb-2 sticky top-0 bg-gray-900/95">
          Event Log ({logs.length}/{maxLogs})
        </h4>
        <div className="space-y-1">
          {logs.length === 0 ? (
            <div className="text-gray-500 text-xs italic">No events yet...</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="bg-gray-800/50 p-2 rounded text-xs">
                <div className="flex justify-between items-start mb-1">
                  <span className={`font-semibold ${
                    log.type === 'sequencer' ? 'text-blue-400' :
                    log.type === 'animation-start' ? 'text-green-400' :
                    log.type === 'animation-end' ? 'text-red-400' :
                    'text-gray-400'
                  }`}>
                    {log.type}
                  </span>
                  <span className="text-gray-500 font-mono text-[10px]">
                    {new Date(log.time).toLocaleTimeString()}.{log.time % 1000}
                  </span>
                </div>
                <pre className="text-gray-300 font-mono text-[10px] overflow-x-auto">
                  {JSON.stringify(log.data, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DebugOverlay;
