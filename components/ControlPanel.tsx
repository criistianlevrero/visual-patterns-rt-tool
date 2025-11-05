

import React, { useState, useRef } from 'react';
import { useTextureStore } from '../store';
import { MidiIcon, ChevronDownIcon, TrashIcon, DownloadIcon, UploadIcon, PlusIcon, CloseIcon } from './icons';
import GradientEditor from './GradientEditor';

interface SliderInputProps {
  label: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  min: number;
  max: number;
  step: number;
  valueFormatter?: (value: number) => string;
}

interface MidiLearnButtonProps {
    isLearning: boolean;
    isMapped: boolean;
    onClick: () => void;
    title?: string;
    learnTitle?: string;
    clearTitle?: string;
}

const MidiLearnButton: React.FC<MidiLearnButtonProps> = ({ 
    isLearning, 
    isMapped, 
    onClick,
    title,
    learnTitle = "Aprender mapeo MIDI",
    clearTitle = "Limpiar mapeo MIDI"
}) => {
    const baseClasses = "w-10 h-10 flex-shrink-0 rounded-lg flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500";
    const stateClasses = isLearning
        ? "bg-orange-500 text-white animate-midi-learn-pulse"
        : isMapped
        ? "bg-cyan-600 text-white"
        : "bg-gray-600 hover:bg-gray-500 text-gray-300";

    const defaultTitle = isMapped ? clearTitle : learnTitle;

    return (
        <button
            type="button"
            onClick={onClick}
            className={`${baseClasses} ${stateClasses}`}
            title={title || defaultTitle}
            aria-label={title || defaultTitle}
        >
            <MidiIcon className="w-5 h-5" />
        </button>
    );
};


const SliderInput: React.FC<SliderInputProps> = ({ label, value, onChange, min, max, step, valueFormatter }) => {
  const displayValue = valueFormatter ? valueFormatter(value) : `${value}px`;
  
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label htmlFor={label} className="font-medium text-gray-300">
          {label}
        </label>
        <span className="text-sm font-mono bg-gray-700 text-cyan-300 px-2 py-1 rounded">
          {displayValue}
        </span>
      </div>
      <input
        id={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
      />
    </div>
  );
};

const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center py-4 text-lg font-semibold text-gray-100 hover:text-cyan-400 transition-colors"
        aria-expanded={isOpen}
      >
        <span>{title}</span>
        <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="pb-6 space-y-6">
          {children}
        </div>
      )}
    </div>
  );
};


const ControlPanel: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Select state and actions from the store
  // FIX: Explicitly type state in selector to fix type inference issue.
  const {
    project,
    activeSequenceIndex,
    currentSettings,
    midiDevices,
    selectedMidiDevice,
    midiMappings,
    learningMidiControl,
    selectedPatternId,
    isPatternDirty,
    learningPatternMidiNote,
    midiConnectionError,
    renderer,
  } = useTextureStore((state: ReturnType<typeof useTextureStore.getState>) => ({
    project: state.project,
    activeSequenceIndex: state.activeSequenceIndex,
    currentSettings: state.currentSettings,
    midiDevices: state.midi.devices,
    selectedMidiDevice: state.midi.selectedDeviceId,
    // FIX: Use optional chaining to prevent crash if project is null
    midiMappings: state.project?.globalSettings.midiMappings ?? {},
    learningMidiControl: state.midi.learningControl,
    selectedPatternId: state.selectedPatternId,
    isPatternDirty: state.isPatternDirty,
    learningPatternMidiNote: state.learningPatternMidiNote,
    midiConnectionError: state.midi.connectionError,
    renderer: state.project?.globalSettings.renderer ?? 'webgl',
  }));

  // FIX: Use getState for actions as they don't change and don't require component subscription. This also helps with type inference issues.
  const {
    setCurrentSetting,
    selectMidiDevice,
    startMidiLearning,
    connectMidi,
    saveCurrentPattern,
    overwriteSelectedPattern,
    loadPattern,
    deletePattern,
    startLearningPatternNote,
    clearPatternMidiAssignment,
    exportProject,
    importProject,
    clearMidiError,
    setRenderer,
  } = useTextureStore.getState();

  // FIX: Add a guard to ensure project is loaded before rendering
  if (!project) return null;

  const activeSequence = project.sequences[activeSequenceIndex];
  if (!activeSequence) return null; // Or a loading/error state

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      importProject(file);
      event.target.value = ''; // Reset file input
  };

  const sliders = [
    { id: 'scaleSize', label: 'Tamaño', value: currentSettings.scaleSize, onChange: (v: number) => setCurrentSetting('scaleSize', v), min: 45, max: 400, step: 1, formatter: (v: number) => `${v}px` },
    { id: 'scaleSpacing', label: 'Espaciado Horizontal', value: currentSettings.scaleSpacing, onChange: (v: number) => setCurrentSetting('scaleSpacing', v), min: -0.4, max: 2.0, step: 0.01, formatter: (v: number) => `${(v * 100).toFixed(0)}%` },
    { id: 'verticalOverlap', label: 'Espaciado Vertical', value: currentSettings.verticalOverlap, onChange: (v: number) => setCurrentSetting('verticalOverlap', v), min: -0.4, max: 2.0, step: 0.01, formatter: (v: number) => `${(v * 100).toFixed(0)}%` },
    { id: 'horizontalOffset', label: 'Desplazamiento Horizontal', value: currentSettings.horizontalOffset, onChange: (v: number) => setCurrentSetting('horizontalOffset', v), min: 0, max: 1, step: 0.01, formatter: (v: number) => `${(v * 100).toFixed(0)}%` },
    { id: 'shapeMorph', label: 'Forma de Escama', value: currentSettings.shapeMorph, onChange: (v: number) => setCurrentSetting('shapeMorph', v), min: 0, max: 1, step: 0.01, formatter: (v: number) => {
        if (v < 0.05) return 'Círculo';
        if (v > 0.45 && v < 0.55) return 'Rombo';
        if (v > 0.95) return 'Estrella';
        if (v < 0.5) return 'Círculo → Rombo';
        return 'Rombo → Estrella';
    }},
  ];
  
  const borderSliders = [
      { id: 'scaleBorderWidth', label: 'Grosor de Borde', value: currentSettings.scaleBorderWidth, onChange: (v: number) => setCurrentSetting('scaleBorderWidth', v), min: 0, max: 10, step: 0.1, formatter: (v: number) => `${v.toFixed(1)}px` },
  ];

  const transformSliders = [
      { 
        id: 'textureRotationSpeed', 
        label: 'Rotación de Textura', 
        value: currentSettings.textureRotationSpeed, 
        onChange: (v: number) => setCurrentSetting('textureRotationSpeed', v), 
        min: -5, 
        max: 5, 
        step: 0.1, 
        formatter: (v: number) => {
            if (Math.abs(v) < 0.05) return 'Detenido';
            const speed = Math.abs(v).toFixed(1);
            return v > 0 ? `→ ${speed}` : `← ${speed}`;
        }
      },
  ];

  const animationSliders = [
    { id: 'animationSpeed', label: 'Velocidad de Animación', value: currentSettings.animationSpeed, onChange: (v: number) => setCurrentSetting('animationSpeed', v), min: 0.10, max: 2.50, step: 0.05, formatter: (v: number) => `${v.toFixed(2)}x` },
    { id: 'animationDirection', label: 'Dirección de Animación', value: currentSettings.animationDirection, onChange: (v: number) => setCurrentSetting('animationDirection', v), min: 0, max: 360, step: 1, formatter: (v: number) => `${Math.round(v)}°` },
  ];

  return (
    <div className="divide-y divide-gray-700">
        <CollapsibleSection title="Configuración MIDI" defaultOpen>
            {midiConnectionError ? (
                <div className="mb-4 bg-red-900/60 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative text-sm" role="alert">
                    <strong className="font-bold block mb-2">Error de Conexión MIDI</strong>
                    <p className="mt-1">{midiConnectionError}</p>
                     <div className="mt-4 flex items-center space-x-3">
                        <button
                            onClick={connectMidi}
                            className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2 px-3 rounded-md text-xs transition-colors"
                        >
                            Reintentar
                        </button>
                         <button
                            onClick={clearMidiError}
                            className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-3 rounded-md text-xs transition-colors"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            ) : midiDevices.length > 0 ? (
                <div className="space-y-3">
                     <label htmlFor="midiDevice" className="font-medium text-gray-300">Dispositivo de Entrada</label>
                        <select 
                            id="midiDevice"
                            value={selectedMidiDevice || ''}
                            onChange={(e) => selectMidiDevice(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 text-gray-200 rounded-lg p-2 focus:ring-cyan-500 focus:border-cyan-500"
                        >
                            <option value="">-- No Conectado --</option>
                            {midiDevices.map(device => (
                                <option key={device.id} value={device.id}>{device.name}</option>
                            ))}
                        </select>
                </div>
            ) : (
                <button
                    onClick={connectMidi}
                    className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500"
                >
                    Conectar MIDI
                </button>
            )}
        </CollapsibleSection>

        <CollapsibleSection title="Patrones">
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => saveCurrentPattern()}
                        className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                        Guardar como Nuevo
                    </button>
                    <button
                        onClick={overwriteSelectedPattern}
                        disabled={!selectedPatternId}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                        title={!selectedPatternId ? "Carga un patrón para sobrescribirlo" : "Sobrescribir el patrón seleccionado"}
                    >
                        Sobrescribir
                    </button>
                </div>
                <div className="space-y-2 pt-2">
                    <h4 className="font-medium text-gray-400">Memorias Guardadas</h4>
                    {activeSequence.patterns.length === 0 ? (
                        <p className="text-gray-500 text-sm">No hay patrones guardados.</p>
                    ) : (
                        activeSequence.patterns.map(pattern => (
                            <div key={pattern.id} className="flex items-center bg-gray-700/50 p-2 rounded-lg space-x-2">
                                <span
                                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-200 ${
                                        selectedPatternId === pattern.id 
                                            ? (isPatternDirty ? 'bg-orange-400 animate-midi-learn-pulse' : 'bg-cyan-400 shadow-[0_0_5px_theme(colors.cyan.400)]')
                                            : 'bg-gray-600'
                                    }`}
                                    aria-hidden="true"
                                />
                                <button onClick={() => loadPattern(pattern.id)} className="flex-grow text-left px-2 py-1 hover:bg-gray-600 rounded-md transition-colors">
                                    {pattern.name}
                                </button>
                                <span className="text-xs font-mono text-cyan-400 w-12 text-center">
                                    {pattern.midiNote !== undefined ? `N: ${pattern.midiNote}` : '-'}
                                </span>
                                <MidiLearnButton
                                    isLearning={learningPatternMidiNote === pattern.id}
                                    isMapped={pattern.midiNote !== undefined}
                                    onClick={() => pattern.midiNote === undefined ? startLearningPatternNote(pattern.id) : clearPatternMidiAssignment(pattern.id)}
                                    learnTitle={`Asignar nota MIDI a ${pattern.name}`}
                                    clearTitle={`Limpiar nota de ${pattern.name}`}
                                />
                                <button onClick={() => deletePattern(pattern.id)} className="w-10 h-10 flex-shrink-0 rounded-lg flex items-center justify-center bg-gray-600 hover:bg-red-500/80 text-gray-300 hover:text-white transition-colors" aria-label={`Eliminar ${pattern.name}`}>
                                    <TrashIcon className="w-5 h-5"/>
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </CollapsibleSection>

        <CollapsibleSection title="Controles de Textura">
            {sliders.map(s => (
                <div key={s.id} className="flex items-center space-x-4">
                    <div className="flex-grow">
                        <SliderInput label={s.label} value={s.value} onChange={(e) => s.onChange(Number(e.target.value))} min={s.min} max={s.max} step={s.step} valueFormatter={s.formatter} />
                    </div>
                    <MidiLearnButton isLearning={learningMidiControl === s.id} isMapped={midiMappings[s.id] !== undefined} onClick={() => startMidiLearning(s.id)} />
                </div>
            ))}
        </CollapsibleSection>
        
        <CollapsibleSection title="Controles de Borde">
              <div className="space-y-3">
                  <div className="flex justify-between items-center">
                      <label htmlFor="borderColor" className="font-medium text-gray-300">
                          Color de Borde
                      </label>
                       <span className="text-sm font-mono bg-gray-700 text-cyan-300 px-2 py-1 rounded uppercase">
                          {currentSettings.scaleBorderColor}
                      </span>
                  </div>
                   <input
                      id="borderColor"
                      type="color"
                      value={currentSettings.scaleBorderColor}
                      onChange={(e) => setCurrentSetting('scaleBorderColor', e.target.value)}
                      className="w-full h-10 p-1 bg-gray-700 border-2 border-gray-600 rounded-lg cursor-pointer"
                  />
              </div>
               {borderSliders.map(s => (
                    <div key={s.id} className="flex items-center space-x-4">
                        <div className="flex-grow">
                            <SliderInput label={s.label} value={s.value} onChange={(e) => s.onChange(Number(e.target.value))} min={s.min} max={s.max} step={s.step} valueFormatter={s.formatter} />
                        </div>
                        <MidiLearnButton isLearning={learningMidiControl === s.id} isMapped={midiMappings[s.id] !== undefined} onClick={() => startMidiLearning(s.id)} />
                    </div>
                ))}
        </CollapsibleSection>

       <CollapsibleSection title="Transformación de Textura">
          {transformSliders.map(s => (
                    <div key={s.id} className="flex items-center space-x-4">
                        <div className="flex-grow">
                            <SliderInput label={s.label} value={s.value} onChange={(e) => s.onChange(Number(e.target.value))} min={s.min} max={s.max} step={s.step} valueFormatter={s.formatter} />
                        </div>
                        <MidiLearnButton isLearning={learningMidiControl === s.id} isMapped={midiMappings[s.id] !== undefined} onClick={() => startMidiLearning(s.id)} />
                    </div>
                ))}
      </CollapsibleSection>

      <CollapsibleSection title="Gradiente y Animación">
          <div className="pb-4 mb-4 border-b border-gray-700/50">
            <GradientEditor />
          </div>
          {animationSliders.map(s => (
                    <div key={s.id} className="flex items-center space-x-4">
                        <div className="flex-grow">
                            <SliderInput label={s.label} value={s.value} onChange={(e) => s.onChange(Number(e.target.value))} min={s.min} max={s.max} step={s.step} valueFormatter={s.formatter} />
                        </div>
                        <MidiLearnButton isLearning={learningMidiControl === s.id} isMapped={midiMappings[s.id] !== undefined} onClick={() => startMidiLearning(s.id)} />
                    </div>
                ))}
      </CollapsibleSection>

      <CollapsibleSection title="Configuración Global">
            <div className="space-y-4">
                <div>
                    <h4 className="font-medium text-gray-300">Gestión de Datos</h4>
                    <p className="text-sm text-gray-400 mt-1">
                        Guarda o carga tu configuración (patrones y mapeos MIDI) en un archivo.
                    </p>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                        <button 
                            onClick={exportProject} 
                            className="flex items-center justify-center w-full bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                        >
                            <DownloadIcon className="w-5 h-5 mr-2" />
                            Exportar
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileImport}
                            className="hidden"
                            accept=".json"
                        />
                        <button 
                            onClick={handleImportClick} 
                            className="flex items-center justify-center w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                        >
                             <UploadIcon className="w-5 h-5 mr-2" />
                            Importar
                        </button>
                    </div>
                </div>
                 <div className="pt-4 mt-4 border-t border-gray-700">
                    <h4 className="font-medium text-gray-300">Motor de Renderizado</h4>
                    <p className="text-sm text-gray-400 mt-1 mb-3">
                        WebGL ofrece un rendimiento superior. Cambia a Canvas 2D si experimentas problemas de compatibilidad.
                    </p>
                    <div className="flex bg-gray-700 p-1 rounded-lg">
                        <button
                            onClick={() => setRenderer('webgl')}
                            className={`w-1/2 py-1.5 rounded-md text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500 ${
                                renderer === 'webgl' ? 'bg-cyan-600 text-white shadow' : 'hover:bg-gray-600 text-gray-300'
                            }`}
                        >
                            WebGL (Recomendado)
                        </button>
                        <button
                            onClick={() => setRenderer('canvas2d')}
                            className={`w-1/2 py-1.5 rounded-md text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500 ${
                                renderer === 'canvas2d' ? 'bg-cyan-600 text-white shadow' : 'hover:bg-gray-600 text-gray-300'
                            }`}
                        >
                            Canvas 2D
                        </button>
                    </div>
                </div>
            </div>
      </CollapsibleSection>
    </div>
  );
};

export default ControlPanel;