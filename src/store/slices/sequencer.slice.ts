import { produce } from 'immer';
import type { StateCreator } from 'zustand';
import type { StoreState, SequencerActions } from '../types';
import type { ControlSettings, PropertyTrack, Keyframe, SliderControlConfig } from '../../types';
import { ControlSource } from '../../types';
import { lerp } from '../utils/helpers';
import { renderers } from '../../components/renderers';
import { env } from '../../config';

export const createSequencerSlice: StateCreator<StoreState, [], [], SequencerActions> = (set, get) => ({
    setIsSequencerPlaying: (isPlaying) => {
        const { project, sequencerTimeoutId } = get();
        if (!project) return;
        
        const newProject = produce(project, draft => {
            draft.globalSettings.isSequencerPlaying = isPlaying;
        });
        get().setProject(newProject);

        if (sequencerTimeoutId) clearTimeout(sequencerTimeoutId);
        
        if (isPlaying) {
            set({ 
                sequencerCurrentStep: -1,
                sequencerStartTime: Date.now(),
            }); 
            get()._tickSequencer();
        } else {
            set({ sequencerTimeoutId: null });
        }
    },
    
    setSequencerCurrentStep: (step) => {
        set({ sequencerCurrentStep: step });
    },
    
    _tickSequencer: () => {
        const { project, activeSequenceIndex, selectedPatternId, requestPropertyChange, currentSettings } = get();
        if (!project || !project.globalSettings.isSequencerPlaying) return;
        
        const activeSequence = project.sequences[activeSequenceIndex];
        const { sequencer } = activeSequence;
        const numSteps = sequencer.numSteps;
        
        const nextStep = (get().sequencerCurrentStep + 1) % numSteps;
        set({ sequencerCurrentStep: nextStep });
        
        const patternIdToLoad = sequencer.steps[nextStep];
        
        // DEBUG: Log sequencer tick
        if (env.debug.sequencer) {
            console.log('[SEQUENCER] Tick', {
                timestamp: Date.now(),
                step: nextStep,
                patternIdToLoad,
                currentPatternId: selectedPatternId,
                willLoadPattern: patternIdToLoad && patternIdToLoad !== selectedPatternId,
            });
        }
        
        // --- 1. Load base pattern if it changes (animate only differences) ---
        if (patternIdToLoad && patternIdToLoad !== selectedPatternId) {
            const newPattern = activeSequence.patterns.find(p => p.id === patternIdToLoad);
            const previousPattern = activeSequence.patterns.find(p => p.id === selectedPatternId);
            
            if (newPattern) {
                const interpolationSteps = activeSequence.interpolationSpeed;
                
                // Compare with previous pattern settings (or current settings if no previous pattern)
                const baseSettings = previousPattern?.settings || currentSettings;
                
                // Calculate properties that differ
                const changedKeys = (Object.keys(newPattern.settings) as Array<keyof ControlSettings>).filter(key => {
                    const newValue = newPattern.settings[key];
                    const oldValue = baseSettings[key];
                    
                    // Deep comparison for arrays (gradients)
                    if (Array.isArray(newValue) && Array.isArray(oldValue)) {
                        return JSON.stringify(newValue) !== JSON.stringify(oldValue);
                    }
                    return newValue !== oldValue;
                });
                
                if (env.debug.sequencer) {
                    console.log('[SEQUENCER] Pattern change - animating only differences', {
                        timestamp: Date.now(),
                        fromPattern: selectedPatternId,
                        toPattern: patternIdToLoad,
                        totalProps: Object.keys(newPattern.settings).length,
                        changedProps: changedKeys.length,
                        changedKeys,
                        interpolationSteps,
                    });
                }
                
                // Request property changes only for properties that differ
                changedKeys.forEach(key => {
                    const from = baseSettings[key];
                    const to = newPattern.settings[key];
                    requestPropertyChange(
                        key,
                        from,
                        to,
                        interpolationSteps,
                        ControlSource.PatternSequencer,
                        'linear'
                    );
                });
                
                // Update selection state
                set({
                    selectedPatternId: patternIdToLoad,
                    isPatternDirty: false
                });
            }
        }

        // --- 2. Apply property automation using requestPropertyChange ---
        const { propertyTracks } = sequencer;
        if (propertyTracks && propertyTracks.length > 0) {
            const rendererId = project.globalSettings.renderer;
            const renderer = renderers[rendererId];
            
            const sliderConfigs = renderer?.controlSchema
                .flatMap(section => section.controls)
                .filter(c => c.type === 'slider')
                .reduce((acc, c: any) => {
                    acc[c.id] = c;
                    return acc;
                }, {} as { [key: string]: any });

            propertyTracks.forEach(track => {
                const sortedKeyframes = [...track.keyframes].sort((a, b) => a.step - b.step);
                if (sortedKeyframes.length === 0) return;

                let prevKeyframe = sortedKeyframes.find(k => k.step <= nextStep) || sortedKeyframes[sortedKeyframes.length - 1];
                let nextKeyframe = sortedKeyframes.find(k => k.step > nextStep) || sortedKeyframes[0];

                if (sortedKeyframes.every(k => k.step > nextStep)) {
                    prevKeyframe = sortedKeyframes[sortedKeyframes.length - 1];
                }
                 if (sortedKeyframes.every(k => k.step <= nextStep)) {
                    nextKeyframe = sortedKeyframes[0];
                }
                
                let interpolatedValue: number;
                if (prevKeyframe.step === nextKeyframe.step) {
                    interpolatedValue = prevKeyframe.value;
                } else {
                    let stepDiff = nextKeyframe.step - prevKeyframe.step;
                    let progress = nextStep - prevKeyframe.step;
                    
                    if (stepDiff < 0) {
                        stepDiff += numSteps;
                        if (progress < 0) progress += numSteps;
                    }
                    const t = progress / stepDiff;
                    interpolatedValue = lerp(prevKeyframe.value, nextKeyframe.value, t);
                }

                if (sliderConfigs && sliderConfigs[track.property]) {
                    // Request immediate property change via animation system
                    requestPropertyChange(
                        track.property,
                        currentSettings[track.property],
                        interpolatedValue,
                        0, // Immediate change
                        ControlSource.PropertySequencer,
                        'linear'
                    );
                }
            });
            
            // DEBUG: Log property automation results
            if (env.debug.propertySequencer) {
                const automatedProps = propertyTracks.map(track => {
                    const sortedKeyframes = [...track.keyframes].sort((a, b) => a.step - b.step);
                    if (sortedKeyframes.length === 0) return null;
                    
                    let prevKeyframe = sortedKeyframes.find(k => k.step <= nextStep) || sortedKeyframes[sortedKeyframes.length - 1];
                    let nextKeyframe = sortedKeyframes.find(k => k.step > nextStep) || sortedKeyframes[0];
                    
                    if (sortedKeyframes.every(k => k.step > nextStep)) {
                        prevKeyframe = sortedKeyframes[sortedKeyframes.length - 1];
                    }
                    if (sortedKeyframes.every(k => k.step <= nextStep)) {
                        nextKeyframe = sortedKeyframes[0];
                    }
                    
                    let interpolatedValue: number;
                    if (prevKeyframe.step === nextKeyframe.step) {
                        interpolatedValue = prevKeyframe.value;
                    } else {
                        let stepDiff = nextKeyframe.step - prevKeyframe.step;
                        let progress = nextStep - prevKeyframe.step;
                        
                        if (stepDiff < 0) {
                            stepDiff += numSteps;
                            if (progress < 0) progress += numSteps;
                        }
                        const t = progress / stepDiff;
                        interpolatedValue = lerp(prevKeyframe.value, nextKeyframe.value, t);
                    }
                    
                    return {
                        property: track.property,
                        value: interpolatedValue,
                    };
                }).filter(Boolean);
                
                console.log('[PROPERTY_SEQ] Automation applied', {
                    timestamp: Date.now(),
                    step: nextStep,
                    tracksCount: propertyTracks.length,
                    automatedProps,
                });
            }
        }
        
        // Calculate next tick using precise timing
        const { sequencerStartTime } = get();
        const stepDuration = (60 / sequencer.bpm) * 1000 / 4;
        
        if (sequencerStartTime) {
            if (nextStep === 0) {
                const newStartTime = Date.now();
                set({ sequencerStartTime: newStartTime });
                const timeoutId = window.setTimeout(get()._tickSequencer, stepDuration);
                set({ sequencerTimeoutId: timeoutId });
                
                if (env.debug.sequencer) {
                    console.log('[SEQUENCER] Loop reset', {
                        timestamp: Date.now(),
                        step: nextStep,
                        newStartTime,
                        delay: stepDuration,
                    });
                }
            } else {
                const idealNextTime = sequencerStartTime + (nextStep * stepDuration);
                const now = Date.now();
                const delay = Math.max(0, idealNextTime - now);
                
                if (env.debug.sequencer) {
                    console.log('[SEQUENCER] Timing', {
                        now,
                        idealNextTime,
                        delay,
                        drift: now - (sequencerStartTime + ((nextStep - 1) * stepDuration)),
                    });
                }
                
                const timeoutId = window.setTimeout(get()._tickSequencer, delay);
                set({ sequencerTimeoutId: timeoutId });
            }
        } else {
            const timeoutId = window.setTimeout(get()._tickSequencer, stepDuration);
            set({ sequencerTimeoutId: timeoutId });
        }
    },

    setSequencerBpm: (bpm) => {
        const { project, activeSequenceIndex } = get();
        if (!project) return;
        const newProject = produce(project, draft => {
            draft.sequences[activeSequenceIndex].sequencer.bpm = bpm;
        });
        get().setProject(newProject);
    },

    setSequencerSteps: (steps) => {
        const { project, activeSequenceIndex } = get();
        if (!project) return;
        const newProject = produce(project, draft => {
            draft.sequences[activeSequenceIndex].sequencer.steps = steps;
        });
        get().setProject(newProject);
    },
    
    setSequencerNumSteps: (numSteps) => {
        const { project, activeSequenceIndex } = get();
        if (!project) return;

        const newProject = produce(project, draft => {
            const seq = draft.sequences[activeSequenceIndex].sequencer;
            seq.numSteps = numSteps;
            const currentLength = seq.steps.length;
            if (numSteps > currentLength) {
                seq.steps.push(...Array(numSteps - currentLength).fill(null));
            } else {
                seq.steps.length = numSteps;
            }
        });
        get().setProject(newProject);
    },
    
    addPropertyTrack: (property) => {
        const { project, activeSequenceIndex } = get();
        if (!project) return;
        
        const newTrack: PropertyTrack = {
            id: crypto.randomUUID(),
            property,
            keyframes: [],
        };

        const newProject = produce(project, draft => {
            const sequencer = draft.sequences[activeSequenceIndex].sequencer;
            if (!sequencer.propertyTracks) sequencer.propertyTracks = [];
            sequencer.propertyTracks.push(newTrack);
        });
        get().setProject(newProject);
    },

    removePropertyTrack: (trackId) => {
        const { project, activeSequenceIndex } = get();
        if (!project) return;
        
        const newProject = produce(project, draft => {
            const sequencer = draft.sequences[activeSequenceIndex].sequencer;
            sequencer.propertyTracks = sequencer.propertyTracks.filter(t => t.id !== trackId);
        });
        get().setProject(newProject);
    },

    addKeyframe: (trackId, step) => {
        const { project, activeSequenceIndex } = get();
        if (!project) return;

        const newProject = produce(project, draft => {
            const track = draft.sequences[activeSequenceIndex].sequencer.propertyTracks.find(t => t.id === trackId);
            if (!track || track.keyframes.some(k => k.step === step)) return;

            const rendererId = draft.globalSettings.renderer;
            const renderer = renderers[rendererId];
            const control = renderer?.controlSchema.flatMap(s => s.controls).find(c => c.type === 'slider' && c.id === track.property) as SliderControlConfig | undefined;
            
            if (control) {
                const defaultValue = control.min + (control.max - control.min) * 0.5;
                const newKeyframe: Keyframe = { step, value: defaultValue, interpolation: 'linear' };
                track.keyframes.push(newKeyframe);
            }
        });
        get().setProject(newProject);
    },

    updateKeyframeValue: (trackId, step, value) => {
        const { project, activeSequenceIndex } = get();
        if (!project) return;
        
        const newProject = produce(project, draft => {
            const track = draft.sequences[activeSequenceIndex].sequencer.propertyTracks.find(t => t.id === trackId);
            if (!track) return;
            const keyframe = track.keyframes.find(k => k.step === step);
            if (keyframe) {
                keyframe.value = value;
            }
        });
        get().setProject(newProject);
    },

    removeKeyframe: (trackId, step) => {
        const { project, activeSequenceIndex } = get();
        if (!project) return;
        
        const newProject = produce(project, draft => {
            const track = draft.sequences[activeSequenceIndex].sequencer.propertyTracks.find(t => t.id === trackId);
            if (track) {
                track.keyframes = track.keyframes.filter(k => k.step !== step);
            }
        });
        get().setProject(newProject);
    },
});
