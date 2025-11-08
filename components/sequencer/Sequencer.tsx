
import React from 'react';
import { useTextureStore } from '../../store';
import { PlayIcon, StopIcon, PlusIcon, TrashIcon } from '../shared/icons';
import CollapsibleSection from '../shared/CollapsibleSection';
import PropertySequencer from './PropertySequencer';
import { Button } from '../shared/Button';
import { SequencerCell } from '../shared/SequencerCell';
import type { Sequence } from '../../types';

const Sequencer: React.FC = () => {
    const {
        project,
        activeSequenceIndex,
        isSequencerPlaying,
        sequencerCurrentStep,
    } = useTextureStore((state) => ({
        project: state.project,
        activeSequenceIndex: state.activeSequenceIndex,
        isSequencerPlaying: state.project?.globalSettings.isSequencerPlaying ?? false,
        sequencerCurrentStep: state.sequencerCurrentStep,
    }));
    
    const { 
        setIsSequencerPlaying, 
        setSequencerBpm, 
        setSequencerSteps,
        setActiveSequenceIndex,
        updateActiveSequence,
        setSequencerNumSteps,
    } = useTextureStore.getState();


    if (!project) return null;
    const activeSequence = project.sequences[activeSequenceIndex];
    if (!activeSequence) return null;

    const { patterns, sequencer } = activeSequence;
    const { steps, bpm, numSteps } = sequencer;

    const handleStepClick = (patternId: string, stepIndex: number) => {
        const newSteps = [...steps];
        if (newSteps[stepIndex] === patternId) {
            newSteps[stepIndex] = null;
        } else {
            newSteps[stepIndex] = patternId;
        }
        setSequencerSteps(newSteps);
    };

    const handleSequenceChange = (key: keyof Sequence, value: any) => {
        updateActiveSequence({ [key]: value });
    };
    
    const StepSelectorButton: React.FC<{steps: number}> = ({ steps }) => {
        const isActive = numSteps === steps;
        return (
            <Button 
                variant={isActive ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setSequencerNumSteps(steps)}
            >
                {steps}
            </Button>
        )
    };

    return (
        <div className="space-y-3">
            {/* --- TRANSPORT SECTION --- */}
            <div className="bg-gray-800/50 rounded-lg p-3 space-y-3">
                {/* Row 1: Sequence selector - full width on mobile */}
                <div className="space-y-1.5">
                    <label htmlFor="sequence-selector" className="font-medium text-gray-300 text-xs block">
                        Secuencia Activa
                    </label>
                    <div className="flex gap-2">
                        <select
                            id="sequence-selector"
                            value={activeSequenceIndex}
                            onChange={e => setActiveSequenceIndex(Number(e.target.value))}
                            className="flex-1 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm"
                        >
                            {project.sequences.map((seq, index) => (
                                <option key={seq.id} value={index}>{seq.name}</option>
                            ))}
                        </select>
                        <Button 
                            variant="secondary"
                            size="icon"
                            icon={<PlusIcon className="w-5 h-5"/>}
                            iconOnly
                            title="Añadir secuencia (próximamente)" 
                            disabled
                        />
                        <Button 
                            variant="danger"
                            size="icon"
                            icon={<TrashIcon className="w-5 h-5"/>}
                            iconOnly
                            title="Eliminar secuencia (próximamente)" 
                            disabled
                        />
                    </div>
                </div>

                {/* Row 2: Transport controls - responsive grid */}
                <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr_auto] gap-3 items-start sm:items-center">
                    {/* Play/Stop button */}
                    <Button
                        variant="primary"
                        size="lg"
                        icon={isSequencerPlaying ? <StopIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                        iconOnly
                        onClick={() => setIsSequencerPlaying(!isSequencerPlaying)}
                        className="w-12 h-12 mx-auto sm:mx-0"
                        aria-label={isSequencerPlaying ? 'Detener secuenciador' : 'Iniciar secuenciador'}
                    />

                    {/* BPM Control */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <label htmlFor="bpm" className="font-medium text-gray-300 text-xs">
                                BPM
                            </label>
                            <span className="text-xs font-mono bg-gray-900/50 text-cyan-300 px-2 py-0.5 rounded-md min-w-[3rem] text-center">
                                {bpm.toFixed(0)}
                            </span>
                        </div>
                        <input
                            id="bpm"
                            type="range"
                            min="30"
                            max="240"
                            step="1"
                            value={bpm}
                            onChange={(e) => setSequencerBpm(Number(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                    </div>

                    {/* Step Count Selector */}
                    <div className="space-y-1.5">
                        <label className="font-medium text-gray-300 text-xs block">
                            Pasos
                        </label>
                        <div className="flex flex-wrap gap-2">
                            <div className="bg-gray-900/50 p-1 rounded-lg flex gap-1">
                                <StepSelectorButton steps={8} />
                                <StepSelectorButton steps={16} />
                                <StepSelectorButton steps={32} />
                            </div>
                            <div className="bg-gray-900/50 p-1 rounded-lg flex gap-1">
                                <StepSelectorButton steps={6} />
                                <StepSelectorButton steps={12} />
                                <StepSelectorButton steps={24} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sequence Settings - Always visible */}
                <div className="pt-2 border-t border-gray-700">
                    <h3 className="text-xs font-medium text-gray-400 mb-2">Configuración de Secuencia</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400 block">
                                Velocidad de Interpolación
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="range"
                                    min="0"
                                    max="2"
                                    step="0.1"
                                    value={activeSequence.interpolationSpeed}
                                    onChange={(e) => handleSequenceChange('interpolationSpeed', Number(e.target.value))}
                                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                                <span className="text-xs font-mono bg-gray-900/50 text-cyan-300 px-2 py-0.5 rounded min-w-[2.5rem] text-center">
                                    {activeSequence.interpolationSpeed.toFixed(1)}s
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="animateOnlyChanges"
                                checked={activeSequence.animateOnlyChanges}
                                onChange={(e) => handleSequenceChange('animateOnlyChanges', e.target.checked)}
                                className="w-4 h-4 text-cyan-600 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500 focus:ring-2"
                            />
                            <label htmlFor="animateOnlyChanges" className="text-xs text-gray-300">
                                Animar solo cambios
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- PATTERN SEQUENCER --- */}
            <CollapsibleSection title="Secuenciador de Patrones" defaultOpen={true}>
                <div className="relative">
                    {/* Responsive container with horizontal scroll */}
                    <div className="overflow-x-auto -mx-2 px-2 pb-2">
                        <div className="inline-grid gap-1 min-w-full" style={{ 
                            gridTemplateColumns: `minmax(100px, auto) repeat(${numSteps}, minmax(2.5rem, 1fr))` 
                        }}>
                            {/* Header row */}
                            <div className="sticky left-0 bg-gray-800 z-20"></div>
                            {Array.from({ length: numSteps }).map((_, i) => (
                                <div 
                                    key={`header-${i}`} 
                                    className={`flex items-center justify-center text-xs font-medium pb-1 ${
                                        sequencerCurrentStep === i ? 'text-cyan-400' : 'text-gray-500'
                                    }`}
                                >
                                    {i + 1}
                                </div>
                            ))}

                            {/* Pattern rows */}
                            {patterns.map((pattern) => (
                                <React.Fragment key={pattern.id}>
                                    <div className="sticky left-0 bg-gray-800 z-10 text-xs text-gray-400 font-semibold truncate pr-2 flex items-center min-w-[100px]" title={pattern.name}>
                                        <span className="truncate">{pattern.name}</span>
                                    </div>
                                    {Array.from({ length: numSteps }).map((_, stepIndex) => (
                                        <div 
                                            key={`${pattern.id}-${stepIndex}`} 
                                            className={`relative w-full min-h-[2.5rem] ${
                                                sequencerCurrentStep === stepIndex ? 'bg-gray-600/30' : ''
                                            }`}
                                        >
                                            <SequencerCell
                                                variant="pattern"
                                                active={steps[stepIndex] === pattern.id}
                                                onClick={() => handleStepClick(pattern.id, stepIndex)}
                                                className="absolute inset-0.5"
                                            />
                                        </div>
                                    ))}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                    
                    {patterns.length === 0 && (
                        <div className="text-center py-8 text-gray-500 text-sm">
                            <div className="mb-2">🎵</div>
                            <div>Guarda algunos patrones para empezar a secuenciar.</div>
                        </div>
                    )}
                </div>
            </CollapsibleSection>
            
            {/* --- PROPERTY SEQUENCER --- */}
            <CollapsibleSection title="Secuenciador de Propiedades">
                <PropertySequencer />
            </CollapsibleSection>
        </div>
    );
};

export default Sequencer;
