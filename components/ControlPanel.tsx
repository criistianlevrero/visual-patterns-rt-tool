
import React, { useRef } from 'react';
import { useTextureStore } from '../store';
import { TrashIcon, DownloadIcon, UploadIcon } from './icons';
import { renderers } from './renderers';
import { Button } from './shared/Button';
import MidiLearnButton from './renderers/shared/MidiLearnButton';
import CollapsibleSection from './renderers/shared/CollapsibleSection';
import RendererControls from './renderers/shared/RendererControls';

const ControlPanel: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Select state and actions from the store
  const {
    project,
    activeSequenceIndex,
    midiDevices,
    selectedMidiDevice,
    selectedPatternId,
    isPatternDirty,
    learningPatternMidiNote,
    midiConnectionError,
    renderer,
  } = useTextureStore((state: ReturnType<typeof useTextureStore.getState>) => ({
    project: state.project,
    activeSequenceIndex: state.activeSequenceIndex,
    midiDevices: state.midi.devices,
    selectedMidiDevice: state.midi.selectedDeviceId,
    selectedPatternId: state.selectedPatternId,
    isPatternDirty: state.isPatternDirty,
    learningPatternMidiNote: state.learningPatternMidiNote,
    midiConnectionError: state.midi.connectionError,
    renderer: state.project?.globalSettings.renderer ?? 'webgl',
  }));

  const {
    selectMidiDevice,
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

  if (!project) return null;

  const activeSequence = project.sequences[activeSequenceIndex];
  if (!activeSequence) return null; 

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      importProject(file);
      event.target.value = ''; 
  };
  
  const rendererSchema = renderers[renderer]?.controlSchema;

  return (
    <div className="divide-y divide-gray-700 text-sm">
        <CollapsibleSection title="Configuración MIDI" defaultOpen>
            {midiConnectionError ? (
                <div className="mb-3 bg-red-900/60 border border-red-700 text-red-200 px-3 py-2 rounded-lg relative text-xs" role="alert">
                    <strong className="font-bold block mb-1">Error de Conexión MIDI</strong>
                    <p className="mt-1">{midiConnectionError}</p>
                     <div className="mt-3 flex items-center space-x-2">
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={connectMidi}
                        >
                            Reintentar
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={clearMidiError}
                        >
                            Cerrar
                        </Button>
                    </div>
                </div>
            ) : midiDevices.length > 0 ? (
                <div className="space-y-2">
                     <label htmlFor="midiDevice" className="font-medium text-gray-300 text-xs">Dispositivo de Entrada</label>
                        <select 
                            id="midiDevice"
                            value={selectedMidiDevice || ''}
                            onChange={(e) => selectMidiDevice(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 text-gray-200 rounded-lg p-2 focus:ring-cyan-500 focus:border-cyan-500 text-xs"
                        >
                            <option value="">-- No Conectado --</option>
                            {midiDevices.map(device => (
                                <option key={device.id} value={device.id}>{device.name}</option>
                            ))}
                        </select>
                </div>
            ) : (
                <Button
                    variant="primary"
                    onClick={connectMidi}
                    className="w-full"
                >
                    Conectar MIDI
                </Button>
            )}
        </CollapsibleSection>

        <CollapsibleSection title="Patrones">
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <Button
                        variant="primary"
                        onClick={() => saveCurrentPattern()}
                        className="w-full"
                    >
                        Guardar como Nuevo
                    </Button>
                    <Button
                        variant="primary"
                        onClick={overwriteSelectedPattern}
                        disabled={!selectedPatternId}
                        className="w-full"
                        title={!selectedPatternId ? "Carga un patrón para sobrescribirlo" : "Sobrescribir el patrón seleccionado"}
                    >
                        Sobrescribir
                    </Button>
                </div>
                <div className="space-y-1.5 pt-1.5">
                    <h4 className="font-medium text-gray-400 text-xs">Memorias Guardadas</h4>
                    {activeSequence.patterns.length === 0 ? (
                        <p className="text-gray-500 text-xs">No hay patrones guardados.</p>
                    ) : (
                        activeSequence.patterns.map(pattern => (
                            <div key={pattern.id} className="flex items-center bg-gray-700/50 p-1.5 rounded-lg space-x-1.5">
                                <span
                                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-200 ${
                                        selectedPatternId === pattern.id 
                                            ? (isPatternDirty ? 'bg-orange-400 animate-midi-learn-pulse' : 'bg-cyan-400 shadow-[0_0_5px_theme(colors.cyan.400)]')
                                            : 'bg-gray-600'
                                    }`}
                                    aria-hidden="true"
                                />
                                <button onClick={() => loadPattern(pattern.id)} className="flex-grow text-left px-1.5 py-1 hover:bg-gray-600 rounded-md transition-colors text-xs">
                                    {pattern.name}
                                </button>
                                <span className="text-[10px] font-mono text-cyan-400 w-10 text-center">
                                    {pattern.midiNote !== undefined ? `N: ${pattern.midiNote}` : '-'}
                                </span>
                                <MidiLearnButton
                                    isLearning={learningPatternMidiNote === pattern.id}
                                    isMapped={pattern.midiNote !== undefined}
                                    onClick={() => pattern.midiNote === undefined ? startLearningPatternNote(pattern.id) : clearPatternMidiAssignment(pattern.id)}
                                    learnTitle={`Asignar nota MIDI a ${pattern.name}`}
                                    clearTitle={`Limpiar nota de ${pattern.name}`}
                                />
                                <Button
                                    variant="danger"
                                    size="icon"
                                    onClick={() => deletePattern(pattern.id)}
                                    icon={<TrashIcon className="w-4 h-4"/>}
                                    iconOnly
                                    className="w-8 h-8 flex-shrink-0"
                                    aria-label={`Eliminar ${pattern.name}`}
                                />
                            </div>
                        ))
                    )}
                </div>
            </div>
        </CollapsibleSection>
        
        {rendererSchema && <RendererControls schema={rendererSchema} />}

        <CollapsibleSection title="Configuración Global">
            <div className="space-y-3">
                <div>
                    <h4 className="font-medium text-gray-300 text-xs">Gestión de Datos</h4>
                    <p className="text-xs text-gray-400 mt-1">
                        Guarda o carga tu configuración (patrones y mapeos MIDI) en un archivo.
                    </p>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                        <Button 
                            variant="secondary"
                            onClick={exportProject}
                            icon={<DownloadIcon className="w-5 h-5" />}
                            className="w-full"
                        >
                            Exportar
                        </Button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileImport}
                            className="hidden"
                            accept=".json"
                        />
                        <Button 
                            variant="primary"
                            onClick={handleImportClick}
                            icon={<UploadIcon className="w-5 h-5" />}
                            className="w-full"
                        >
                            Importar
                        </Button>
                    </div>
                </div>
                 <div className="pt-3 mt-3 border-t border-gray-700">
                    <h4 className="font-medium text-gray-300 text-xs">Motor de Renderizado</h4>
                    <p className="text-xs text-gray-400 mt-1 mb-2">
                        Selecciona el motor para generar los visuales. WebGL ofrece un rendimiento superior.
                    </p>
                    <select 
                        id="renderer"
                        value={renderer}
                        onChange={(e) => setRenderer(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 text-gray-200 rounded-lg p-2 focus:ring-cyan-500 focus:border-cyan-500 text-xs"
                    >
                        {Object.values(renderers).map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                </div>
            </div>
      </CollapsibleSection>
    </div>
  );
};

export default ControlPanel;
