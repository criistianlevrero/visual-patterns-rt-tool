
import React, { useMemo, useState } from 'react';
import { useTextureStore } from '../../store';
import { renderers } from '../renderers';
import { TrashIcon } from '../shared/icons';
import { Button } from '../shared/Button';
import { SequencerCell } from '../shared/SequencerCell';
import SliderInput from '../controls/SliderInput';
// FIX: SliderControlConfig will be available from ../types after the type definitions are moved.
import type { PropertyTrack, SliderControlConfig } from '../../types';

interface PropertyTrackLaneProps {
    track: PropertyTrack;
}

// Helper function to interpolate values between keyframes
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const PropertyTrackLane: React.FC<PropertyTrackLaneProps> = ({ track }) => {
    const { project, activeSequenceIndex, sequencerCurrentStep } = useTextureStore(state => ({
        project: state.project,
        activeSequenceIndex: state.activeSequenceIndex,
        sequencerCurrentStep: state.sequencerCurrentStep,
    }));
    const { addKeyframe, removeKeyframe, updateKeyframeValue, removePropertyTrack } = useTextureStore.getState();

    const [selectedStep, setSelectedStep] = useState<number | null>(null);

    const sequencer = project?.sequences[activeSequenceIndex].sequencer;
    const numSteps = sequencer?.numSteps ?? 16;

    const controlInfo = useMemo(() => {
        for (const renderer of Object.values(renderers)) {
            for (const section of renderer.controlSchema) {
                const control = section.controls.find(c => c.id === track.property);
                if (control && control.type === 'slider') {
                    // FIX: Also return the category (section title) to be used in the UI.
                    return { ...(control as SliderControlConfig), category: section.title };
                }
            }
        }
        return null;
    }, [track.property]);

    // Calculate interpolated value for a given step
    const getInterpolatedValueForStep = useMemo(() => {
        return (stepIndex: number): number | null => {
            const sortedKeyframes = [...track.keyframes].sort((a, b) => a.step - b.step);
            if (sortedKeyframes.length === 0) return null;

            let prevKeyframe = sortedKeyframes.find(k => k.step <= stepIndex) || sortedKeyframes[sortedKeyframes.length - 1];
            let nextKeyframe = sortedKeyframes.find(k => k.step > stepIndex) || sortedKeyframes[0];

            if (sortedKeyframes.every(k => k.step > stepIndex)) {
                prevKeyframe = sortedKeyframes[sortedKeyframes.length - 1];
            }
            if (sortedKeyframes.every(k => k.step <= stepIndex)) {
                nextKeyframe = sortedKeyframes[0];
            }

            if (prevKeyframe.step === nextKeyframe.step) {
                return prevKeyframe.value;
            }

            let stepDiff = nextKeyframe.step - prevKeyframe.step;
            let progress = stepIndex - prevKeyframe.step;

            if (stepDiff < 0) { // Loop around
                stepDiff += numSteps;
                if (progress < 0) progress += numSteps;
            }
            const t = progress / stepDiff;
            return lerp(prevKeyframe.value, nextKeyframe.value, t);
        };
    }, [track.keyframes, numSteps]);

    // Check if step has changes compared to previous step
    const stepHasChanges = useMemo(() => {
        if (track.keyframes.length === 0) return Array(numSteps).fill(false);
        
        const hasChanges = Array(numSteps).fill(false);
        for (let i = 0; i < numSteps; i++) {
            const prevStep = i === 0 ? numSteps - 1 : i - 1;
            const currentValue = getInterpolatedValueForStep(i);
            const prevValue = getInterpolatedValueForStep(prevStep);
            
            if (currentValue !== null && prevValue !== null) {
                // Consider a change if difference is more than 0.001 (to handle floating point precision)
                hasChanges[i] = Math.abs(currentValue - prevValue) > 0.001;
            }
        }
        return hasChanges;
    }, [getInterpolatedValueForStep, numSteps, track.keyframes]);

    const selectedKeyframe = useMemo(() => {
        if (selectedStep === null) return null;
        return track.keyframes.find(k => k.step === selectedStep) || null;
    }, [track.keyframes, selectedStep]);
    
    const handleStepClick = (stepIndex: number) => {
        const keyframeExists = track.keyframes.some(k => k.step === stepIndex);

        if (selectedStep === stepIndex) {
            // Clicked on the already selected keyframe -> remove it
            if (keyframeExists) {
                removeKeyframe(track.id, stepIndex);
            }
            setSelectedStep(null);
        } else {
            // Clicked on a new step
            if (!keyframeExists) {
                // If it's an empty step, create a new keyframe
                addKeyframe(track.id, stepIndex);
            }
            // Select the step
            setSelectedStep(stepIndex);
        }
    };

    return (
        <div className="bg-gray-800/60 rounded-lg overflow-hidden">
            {/* Track header */}
            <div className="flex justify-between items-center p-3 bg-gray-900/40">
                <div className="flex-1 min-w-0">
                     <div className="font-semibold text-gray-300 truncate">{controlInfo?.label || track.property}</div>
                     <div className="text-xs text-gray-500 truncate">
                        {controlInfo?.category}
                     </div>
                </div>
                <Button 
                    variant="ghost"
                    size="icon"
                    onClick={() => removePropertyTrack(track.id)}
                    icon={<TrashIcon className="w-4 h-4"/>}
                    iconOnly
                    className="ml-2 hover:text-red-400 hover:bg-red-500/10"
                    title="Eliminar pista"
                />
            </div>

            {/* Timeline container - scrollable horizontally */}
            <div className="overflow-x-auto">
                <div className="inline-block min-w-full">
                    {/* Step Numbers Header */}
                    <div className="grid px-3 pt-2" style={{ gridTemplateColumns: `repeat(${numSteps}, minmax(2.5rem, 1fr))` }}>
                        {Array.from({ length: numSteps }).map((_, i) => {
                            const hasChange = stepHasChanges[i];
                            let colorClass = 'text-white'; // Sin cambios: blanco
                            
                            if (hasChange) {
                                colorClass = 'text-cyan-400'; // Con cambios: cyan (color actual)
                            }
                            
                            if (sequencerCurrentStep === i) {
                                colorClass = 'text-cyan-400 font-bold'; // Paso actual siempre destacado
                            }
                            
                            return (
                                <div 
                                    key={`header-${i}`} 
                                    className={`text-center text-[10px] font-medium pb-1 ${colorClass}`}
                                >
                                    {i + 1}
                                </div>
                            );
                        })}
                    </div>

                    {/* Timeline grid */}
                    <div className="relative px-3 pb-3">
                        <div className="relative grid items-center gap-px" style={{ gridTemplateColumns: `repeat(${numSteps}, minmax(2.5rem, 1fr))`}}>
                            {/* Timeline background and guidelines */}
                            {Array.from({ length: numSteps }).map((_, stepIndex) => {
                                const hasKeyframe = track.keyframes.some(k => k.step === stepIndex);
                                const isCurrentStep = sequencerCurrentStep === stepIndex;
                                
                                return (
                                    <div key={stepIndex} className={`h-12 ${isCurrentStep ? 'bg-cyan-900/40 ring-1 ring-cyan-500/30' : ''}`}>
                                        <SequencerCell
                                            variant="step"
                                            active={hasKeyframe}
                                            selected={selectedStep === stepIndex}
                                            onClick={() => handleStepClick(stepIndex)}
                                            className="w-full h-full"
                                        />
                                    </div>
                                );
                            })}
                            
                            {/* Keyframes */}
                            {track.keyframes.map(keyframe => (
                                <div 
                                    key={keyframe.step}
                                    className={`absolute top-1/2 rounded-full shadow-lg border-2 border-gray-900 pointer-events-none transition-all ${
                                        selectedStep === keyframe.step 
                                            ? 'bg-yellow-400 w-4 h-4 scale-125' 
                                            : 'bg-cyan-400 w-3 h-3'
                                    }`}
                                    style={{ 
                                        left: `calc(${(keyframe.step / numSteps) * 100}% + ${(0.5 / numSteps) * 100}%)`, 
                                        transform: 'translate(-50%, -50%)' 
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Keyframe Editor */}
            {selectedStep !== null && selectedKeyframe && controlInfo && (
                <div className="p-3 bg-gray-900/40 border-t border-gray-700">
                     <SliderInput
                        label={`Paso ${selectedStep + 1}`}
                        value={selectedKeyframe.value}
                        onChange={(e) => updateKeyframeValue(track.id, selectedStep, Number(e.target.value))}
                        min={controlInfo.min}
                        max={controlInfo.max}
                        step={controlInfo.step}
                        valueFormatter={controlInfo.formatter}
                    />
                </div>
            )}
        </div>
    );
};

export default PropertyTrackLane;
