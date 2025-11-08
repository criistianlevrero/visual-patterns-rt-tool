
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTextureStore } from './store';
import ControlPanel from './components/controls/ControlPanel';
import { renderers } from './components/renderers';
import { FishIcon, ConsoleIcon, EnterFullscreenIcon, ExitFullscreenIcon, SettingsIcon, CloseIcon, SequencerIcon } from './components/shared/icons';
import MidiConsole from './components/midi/MidiConsole';
import ViewportControls from './components/controls/ViewportControls';
import Sequencer from './components/sequencer/Sequencer';
import DebugOverlay from './components/debug/DebugOverlay';
import { env } from './config';
import type { Project } from './types';

interface AppProps {
    initialProject: Project;
}

const App: React.FC<AppProps> = ({ initialProject }) => {
  // Initialize the store with the project data loaded from localStorage or default file.
  useEffect(() => {
    useTextureStore.getState().initializeProject(initialProject);
  }, [initialProject]);

  // UI-specific state that doesn't need to live in the global store.
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSequencerDrawerOpen, setIsSequencerDrawerOpen] = useState(false);
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  
  const appRef = useRef<HTMLDivElement>(null);
  const overlayTimeoutRef = useRef<number | null>(null);

  // Get necessary state and actions from the store
  const viewportMode = useTextureStore(state => state.viewportMode);
  const setViewportMode = useTextureStore(state => state.setViewportMode);
  const midiLog = useTextureStore(state => state.midiLog);
  const clearMidiLog = useTextureStore(state => state.clearMidiLog);
  const rendererId = useTextureStore(state => state.project?.globalSettings.renderer ?? 'webgl');


  const handleFullscreenChange = useCallback(() => {
    setIsFullscreen(!!document.fullscreenElement);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      appRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [handleFullscreenChange]);
  
  const handleMouseMove = useCallback(() => {
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current);
    }
    setIsOverlayVisible(true);
    overlayTimeoutRef.current = window.setTimeout(() => {
      setIsOverlayVisible(false);
    }, 3000);
  }, []);

  useEffect(() => {
    if (isFullscreen) {
      window.addEventListener('mousemove', handleMouseMove);
      handleMouseMove();
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
      setIsDrawerOpen(false);
      setIsSequencerDrawerOpen(false);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
    };
  }, [isFullscreen, handleMouseMove]);


  const controlPanel = <ControlPanel />;
  const sequencerPanel = <Sequencer />;
  const CanvasComponent = renderers[rendererId]?.component;

  return (
    <div ref={appRef} className="bg-gray-900">
      {!isFullscreen ? (
        <div className="min-h-screen text-gray-200 font-sans flex flex-col antialiased">
          <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
            <div className="container mx-auto px-3 sm:px-4 lg:px-6">
              <div className="flex items-center justify-between h-12">
                <div className="flex items-center space-x-2">
                  <FishIcon className="h-6 w-6 text-cyan-400" />
                  <h1 className="text-base md:text-lg font-bold text-gray-50">
                    Generador de Textura de Escamas
                  </h1>
                </div>
                <button
                  onClick={toggleFullscreen}
                  className="p-2 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white transition-colors"
                  aria-label="Entrar en pantalla completa"
                >
                  <EnterFullscreenIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
          </header>

          <main className="flex-grow container mx-auto p-3 md:p-4">
            <div className="grid gap-4 items-start grid-cols-1 lg:grid-cols-3">
              <div className="lg:col-span-1 bg-gray-800 p-4 rounded-xl shadow-2xl border border-gray-700">
                {controlPanel}
              </div>
              
              <div className="lg:col-span-2 flex flex-col gap-4">
                <div className="relative bg-gray-800/50 p-3 rounded-xl shadow-2xl border border-gray-700">
                    <ViewportControls mode={viewportMode} onModeChange={setViewportMode} />
                    <div className={
                      viewportMode === 'horizontal'
                        ? "w-full aspect-video overflow-hidden rounded-xl bg-gray-800"
                        : "w-full max-w-sm mx-auto aspect-[9/16] overflow-hidden rounded-xl bg-gray-800"
                    }>
                      {CanvasComponent ? (
                        <CanvasComponent className="w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-500">
                            Error: Renderer no encontrado.
                        </div>
                      )}
                    </div>
                </div>
                <div className="bg-gray-800 p-4 rounded-xl shadow-2xl border border-gray-700">
                  {sequencerPanel}
                </div>
              </div>
            </div>
          </main>

          <footer className="text-center py-2 text-gray-500 text-xs">
            <p>Creado con React, Tailwind CSS y Gemini</p>
          </footer>
        </div>
      ) : (
         <div className="fixed inset-0 w-full h-full">
            {CanvasComponent && <CanvasComponent className="w-full h-full" />}
            <div
              className={`fixed top-4 left-4 right-4 flex justify-between items-center transition-opacity duration-300 z-50 ${isOverlayVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
              <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                    className="p-3 bg-gray-800/70 text-white rounded-full backdrop-blur-sm hover:bg-gray-700/90 transition-colors"
                    aria-label={isDrawerOpen ? "Cerrar controles" : "Abrir controles"}
                  >
                    {isDrawerOpen ? <CloseIcon className="w-6 h-6"/> : <SettingsIcon className="w-6 h-6" />}
                  </button>
                   <button
                    onClick={() => setIsSequencerDrawerOpen(!isSequencerDrawerOpen)}
                    className="p-3 bg-gray-800/70 text-white rounded-full backdrop-blur-sm hover:bg-gray-700/90 transition-colors"
                    aria-label={isSequencerDrawerOpen ? "Cerrar secuenciador" : "Abrir secuenciador"}
                  >
                    {isSequencerDrawerOpen ? <CloseIcon className="w-6 h-6"/> : <SequencerIcon className="w-6 h-6" />}
                  </button>
              </div>
              <button
                onClick={toggleFullscreen}
                className="p-3 bg-gray-800/70 text-white rounded-full backdrop-blur-sm hover:bg-gray-700/90 transition-colors"
                aria-label="Salir de pantalla completa"
              >
                <ExitFullscreenIcon className="w-6 h-6" />
              </button>
            </div>
             
            <div
              className={`fixed top-0 left-0 h-full bg-gray-800/90 backdrop-blur-sm border-r border-gray-700 shadow-2xl transition-transform duration-300 ease-in-out z-40 w-full max-w-md ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
              <div className="p-4 overflow-y-auto h-full text-gray-200">
                {controlPanel}
              </div>
            </div>

            <div
              className={`fixed bottom-0 left-0 right-0 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700 shadow-2xl transition-transform duration-300 ease-in-out z-40 ${isSequencerDrawerOpen ? 'translate-y-0' : 'translate-y-full'}`}
            >
              <div className="p-4 text-gray-200 container mx-auto">
                {sequencerPanel}
              </div>
            </div>
         </div>
      )}
      
      <MidiConsole
        isOpen={isConsoleOpen}
        onClose={() => setIsConsoleOpen(false)}
        log={midiLog}
        onClear={clearMidiLog}
      />
      
      {!isConsoleOpen && !isFullscreen && (
        <button
          onClick={() => setIsConsoleOpen(true)}
          className="fixed bottom-4 right-4 z-50 w-12 h-12 bg-cyan-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-cyan-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-500"
          aria-label="Abrir consola MIDI"
        >
          <ConsoleIcon className="w-6 h-6" />
        </button>
      )}
      
      {/* Debug Overlay - Only visible when VITE_DEBUG_MODE=true */}
      {env.debugMode && <DebugOverlay />}
    </div>
  );
};

export default App;
