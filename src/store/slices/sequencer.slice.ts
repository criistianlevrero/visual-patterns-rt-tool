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
        const { project, sequencerTimeoutId, propertySequencerRafId } = get();
        if (!project) return;
        
        const newProject = produce(project, draft => {
            draft.globalSettings.isSequencerPlaying = isPlaying;
        });
        get().setProject(newProject);

        if (sequencerTimeoutId) clearTimeout(sequencerTimeoutId);
        if (propertySequencerRafId) cancelAnimationFrame(propertySequencerRafId);
        
        if (isPlaying) {
            set({ 
                sequencerCurrentStep: -1,
                sequencerStartTime: Date.now(),
                sequencerLoopCount: 0,
            }); 
            get()._tickSequencer();
            get()._updatePropertySequencer(); // Start RAF loop for property interpolation
        } else {
            set({ 
                sequencerTimeoutId: null,
                propertySequencerRafId: null,
            });
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
        
        // Track loop count for accurate timing calculation
        let newLoopCount = get().sequencerLoopCount;
        if (nextStep === 0 && get().sequencerCurrentStep !== -1) {
            newLoopCount++;
        }
        
        set({ 
            sequencerCurrentStep: nextStep,
            sequencerLoopCount: newLoopCount,
        });
        
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

            // Calculate fractional step for smooth interpolation
            // This allows sub-step precision based on time elapsed since last tick
            const stepDuration = (60 / sequencer.bpm) * 1000 / 4; // milliseconds per step
            const { sequencerStartTime } = get();
            const now = Date.now();
            const timeElapsed = sequencerStartTime ? now - sequencerStartTime : 0;
            const fractionalStep = (timeElapsed / stepDuration) % numSteps;

            propertyTracks.forEach(track => {
                const sortedKeyframes = [...track.keyframes].sort((a, b) => a.step - b.step);
                if (sortedKeyframes.length === 0) return;

                // Find the two keyframes to interpolate between (with loop support)
                let prevKeyframe: Keyframe;
                let nextKeyframe: Keyframe;
                let interpolatedValue: number;
                let debugInfo: any = {
                    property: track.property,
                    currentStep: nextStep,
                    fractionalStep,
                    numSteps,
                    keyframesCount: sortedKeyframes.length,
                    keyframes: sortedKeyframes.map(k => ({ step: k.step, value: k.value })),
                };
                
                if (sortedKeyframes.length === 1) {
                    // Single keyframe: use its value
                    interpolatedValue = sortedKeyframes[0].value;
                    debugInfo.mode = 'single-keyframe';
                    debugInfo.value = interpolatedValue;
                } else {
                    // Find keyframes to interpolate between with proper wrap-around handling
                    let nextIndex = sortedKeyframes.findIndex(k => k.step > fractionalStep);
                    debugInfo.nextIndex = nextIndex;
                    
                    if (nextIndex === -1) {
                        // fractionalStep is after all keyframes: wrap to first keyframe
                        prevKeyframe = sortedKeyframes[sortedKeyframes.length - 1];
                        nextKeyframe = sortedKeyframes[0];
                        debugInfo.mode = 'wrap-after-last';
                    } else if (nextIndex === 0) {
                        // fractionalStep is before first keyframe: wrap from last keyframe
                        prevKeyframe = sortedKeyframes[sortedKeyframes.length - 1];
                        nextKeyframe = sortedKeyframes[0];
                        debugInfo.mode = 'wrap-before-first';
                    } else {
                        // Normal case: between two keyframes
                        prevKeyframe = sortedKeyframes[nextIndex - 1];
                        nextKeyframe = sortedKeyframes[nextIndex];
                        debugInfo.mode = 'normal';
                    }
                    
                    // Calculate interpolation progress using fractional step
                    let stepDiff: number;
                    let progress: number;
                    
                    if (nextKeyframe.step > prevKeyframe.step) {
                        // Normal case: next is after prev
                        stepDiff = nextKeyframe.step - prevKeyframe.step;
                        progress = fractionalStep - prevKeyframe.step;
                        debugInfo.wrapAround = false;
                    } else {
                        // Wrap-around case: next is before prev (loop)
                        stepDiff = (numSteps - prevKeyframe.step) + nextKeyframe.step;
                        progress = fractionalStep > prevKeyframe.step 
                            ? fractionalStep - prevKeyframe.step 
                            : (numSteps - prevKeyframe.step) + fractionalStep;
                        debugInfo.wrapAround = true;
                    }
                    
                    const t = Math.max(0, Math.min(1, progress / stepDiff));
                    interpolatedValue = lerp(prevKeyframe.value, nextKeyframe.value, t);
                    
                    debugInfo.prevKeyframe = { step: prevKeyframe.step, value: prevKeyframe.value };
                    debugInfo.nextKeyframe = { step: nextKeyframe.step, value: nextKeyframe.value };
                    debugInfo.stepDiff = stepDiff;
                    debugInfo.progress = progress;
                    debugInfo.t = t;
                    debugInfo.interpolatedValue = interpolatedValue;
                }

                // Log telemetry data
                if (env.debug.propertySequencer) {
                    console.log('[PROPERTY_SEQ_INTERPOLATION]', debugInfo);
                }

                if (sliderConfigs && sliderConfigs[track.property]) {
                    // Apply value immediately - smoothness comes from high-frequency updates
                    // (calculated on every sequencer tick)
                    requestPropertyChange(
                        track.property,
                        currentSettings[track.property],
                        interpolatedValue,
                        0, // Immediate - no animation needed
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
                    
                    let interpolatedValue: number;
                    
                    if (sortedKeyframes.length === 1) {
                        interpolatedValue = sortedKeyframes[0].value;
                    } else {
                        // Find previous keyframe (at or before current step)
                        const prevIndex = sortedKeyframes.findIndex(k => k.step > nextStep);
                        let prevKeyframe: Keyframe;
                        let nextKeyframe: Keyframe;
                        
                        if (prevIndex === 0) {
                            prevKeyframe = sortedKeyframes[sortedKeyframes.length - 1];
                            nextKeyframe = sortedKeyframes[0];
                        } else if (prevIndex === -1) {
                            prevKeyframe = sortedKeyframes[sortedKeyframes.length - 1];
                            nextKeyframe = sortedKeyframes[0];
                        } else {
                            prevKeyframe = sortedKeyframes[prevIndex - 1];
                            nextKeyframe = sortedKeyframes[prevIndex];
                        }
                        
                        let stepDiff: number;
                        let progress: number;
                        
                        if (nextKeyframe.step > prevKeyframe.step) {
                            stepDiff = nextKeyframe.step - prevKeyframe.step;
                            progress = nextStep - prevKeyframe.step;
                        } else {
                            stepDiff = (numSteps - prevKeyframe.step) + nextKeyframe.step;
                            progress = nextStep > prevKeyframe.step 
                                ? nextStep - prevKeyframe.step 
                                : (numSteps - prevKeyframe.step) + nextStep;
                        }
                        
                        const t = Math.max(0, Math.min(1, progress / stepDiff));
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
        const { sequencerStartTime, sequencerLoopCount } = get();
        const stepDuration = (60 / sequencer.bpm) * 1000 / 4;
        
        if (sequencerStartTime) {
            // Calculate the absolute step number (including all loops)
            const absoluteStep = (sequencerLoopCount * numSteps) + nextStep;
            const idealNextTime = sequencerStartTime + (absoluteStep * stepDuration);
            const now = Date.now();
            const delay = Math.max(0, idealNextTime - now);
            
            if (env.debug.sequencer) {
                console.log('[SEQUENCER] Timing', {
                    now,
                    nextStep,
                    loopCount: sequencerLoopCount,
                    absoluteStep,
                    idealNextTime,
                    delay,
                    drift: now - (sequencerStartTime + ((absoluteStep - 1) * stepDuration)),
                });
            }
            
            const timeoutId = window.setTimeout(get()._tickSequencer, delay);
            set({ sequencerTimeoutId: timeoutId });
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

    _updatePropertySequencer: () => {
        const { project, activeSequenceIndex, requestPropertyChange, currentSettings, sequencerStartTime } = get();
        
        if (!project || !project.globalSettings.isSequencerPlaying || !sequencerStartTime) {
            return;
        }

        const activeSequence = project.sequences[activeSequenceIndex];
        const { sequencer } = activeSequence;
        const { propertyTracks, bpm, numSteps } = sequencer;
        
        if (!propertyTracks || propertyTracks.length === 0) {
            // No tracks, but keep RAF running
            const rafId = requestAnimationFrame(() => get()._updatePropertySequencer());
            set({ propertySequencerRafId: rafId });
            return;
        }

        // Calculate fractional step based on elapsed time
        const stepDuration = (60 / bpm) * 1000 / 4; // milliseconds per step
        const now = Date.now();
        const timeElapsed = now - sequencerStartTime;
        const fractionalStep = (timeElapsed / stepDuration) % numSteps;

        // Debug telemetry
        const debugTelemetry: any[] = [];

        const rendererId = project.globalSettings.renderer;
        const renderer = renderers[rendererId];
        const sliderConfigs = renderer?.controlSchema
            .flatMap(section => section.controls)
            .filter(c => c.type === 'slider')
            .reduce((acc, c: any) => {
                acc[c.id] = c;
                return acc;
            }, {} as { [key: string]: any });

        // Update each property track
        propertyTracks.forEach(track => {
            const sortedKeyframes = [...track.keyframes].sort((a, b) => a.step - b.step);
            if (sortedKeyframes.length === 0) return;

            let interpolatedValue: number;
            const trackDebug: any = {
                property: track.property,
                fractionalStep,
                keyframes: sortedKeyframes.map(k => ({ step: k.step, value: k.value })),
            };

            if (sortedKeyframes.length === 1) {
                interpolatedValue = sortedKeyframes[0].value;
                trackDebug.mode = 'single';
                trackDebug.value = interpolatedValue;
            } else {
                // Find keyframes to interpolate between
                let prevKeyframe: Keyframe;
                let nextKeyframe: Keyframe;
                
                // Find the index of first keyframe AFTER current fractionalStep
                let nextIndex = sortedKeyframes.findIndex(k => k.step > fractionalStep);
                
                if (nextIndex === -1) {
                    // fractionalStep is after all keyframes: wrap to first keyframe
                    prevKeyframe = sortedKeyframes[sortedKeyframes.length - 1];
                    nextKeyframe = sortedKeyframes[0];
                    trackDebug.mode = 'wrap-after-last';
                    trackDebug.nextIndexFound = nextIndex;
                } else if (nextIndex === 0) {
                    // fractionalStep is before first keyframe: wrap from last keyframe
                    prevKeyframe = sortedKeyframes[sortedKeyframes.length - 1];
                    nextKeyframe = sortedKeyframes[0];
                    trackDebug.mode = 'wrap-before-first';
                    trackDebug.nextIndexFound = nextIndex;
                } else {
                    // Normal case: between two keyframes
                    prevKeyframe = sortedKeyframes[nextIndex - 1];
                    nextKeyframe = sortedKeyframes[nextIndex];
                    trackDebug.mode = 'normal';
                    trackDebug.nextIndexFound = nextIndex;
                }

                // Calculate interpolation
                let stepDiff: number;
                let progress: number;

                if (nextKeyframe.step > prevKeyframe.step) {
                    stepDiff = nextKeyframe.step - prevKeyframe.step;
                    progress = fractionalStep - prevKeyframe.step;
                    trackDebug.wrapAround = false;
                } else {
                    stepDiff = (numSteps - prevKeyframe.step) + nextKeyframe.step;
                    progress = fractionalStep > prevKeyframe.step
                        ? fractionalStep - prevKeyframe.step
                        : (numSteps - prevKeyframe.step) + fractionalStep;
                    trackDebug.wrapAround = true;
                }

                const t = Math.max(0, Math.min(1, progress / stepDiff));
                interpolatedValue = lerp(prevKeyframe.value, nextKeyframe.value, t);
                
                trackDebug.prevKeyframe = { step: prevKeyframe.step, value: prevKeyframe.value };
                trackDebug.nextKeyframe = { step: nextKeyframe.step, value: nextKeyframe.value };
                trackDebug.stepDiff = stepDiff;
                trackDebug.progress = progress;
                trackDebug.t = t;
                trackDebug.interpolatedValue = interpolatedValue;
            }

            debugTelemetry.push(trackDebug);

            // Apply the interpolated value immediately
            if (sliderConfigs && sliderConfigs[track.property]) {
                requestPropertyChange(
                    track.property,
                    currentSettings[track.property],
                    interpolatedValue,
                    0, // Immediate - smoothness comes from RAF frequency
                    ControlSource.PropertySequencer,
                    'linear'
                );
            }
        });

        // Log telemetry periodically (every ~30 frames = 2 times per second at 60fps)
        if (env.debug.propertySequencer && Math.floor(fractionalStep * 30) % 30 === 0) {
            console.log('[PROPERTY_SEQ_RAF]', {
                timestamp: now,
                timeElapsed,
                fractionalStep: fractionalStep.toFixed(3),
                integerStep: Math.floor(fractionalStep),
                numSteps,
                bpm,
                tracks: debugTelemetry,
            });
        }

        // Continue RAF loop
        const rafId = requestAnimationFrame(() => get()._updatePropertySequencer());
        set({ propertySequencerRafId: rafId });
    },
});
