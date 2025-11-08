import { createWithEqualityFn } from 'zustand/traditional';
import { produce } from 'immer';
import { shallow } from 'zustand/shallow';
import { renderers } from './components/renderers';
// FIX: `ControlSection` and `SliderControlConfig` are moved to `types.ts` so this import will now work.
import type { Project, ControlSettings, Pattern, GradientColor, MidiLogEntry, PropertyTrack, Keyframe, ControlSection, SliderControlConfig } from './types';

const LOCAL_STORAGE_KEY = 'textureAppProject';

// --- State and Actions Interfaces ---

interface MidiState {
    devices: MIDIInput[];
    selectedDeviceId: string | null;
    learningControl: string | null;
    noteOnTime: { [key: number]: number };
    connectionError: string | null;
}

interface State {
    project: Project | null;
    activeSequenceIndex: number;
    currentSettings: ControlSettings;
    textureRotation: number;
    isPatternDirty: boolean;
    selectedPatternId: string | null;
    learningPatternMidiNote: string | null;
    sequencerCurrentStep: number;
    sequencerTimeoutId: number | null;
    sequencerStartTime: number | null;  // Track start time for precise timing
    animationFrameRef: number | null;
    lastAppliedSettingsRef: ControlSettings | null;
    previousGradient: GradientColor[] | null;
    previousBackgroundGradient: GradientColor[] | null;
    transitionProgress: number;
    midi: MidiState;
    midiLog: MidiLogEntry[];
    viewportMode: 'horizontal' | 'vertical';
}

interface Actions {
    // Initialization
    initializeProject: (project: Project) => void;
    
    // Project and Sequence management
    setProject: (project: Project) => void;
    setActiveSequenceIndex: (index: number) => void;
    updateActiveSequence: (updates: Partial<Project['sequences'][0]>) => void;
    exportProject: () => void;
    importProject: (file: File) => void;

    // Settings and Pattern control
    setCurrentSetting: <K extends keyof ControlSettings>(key: K, value: ControlSettings[K]) => void;
    saveCurrentPattern: (midiNote?: number) => void;
    overwriteSelectedPattern: () => void;
    loadPattern: (id: string) => void;
    deletePattern: (id: string) => void;
    startLearningPatternNote: (patternId: string) => void;
    clearPatternMidiAssignment: (patternId: string) => void;

    // Sequencer control
    setIsSequencerPlaying: (isPlaying: boolean) => void;
    setSequencerCurrentStep: (step: number) => void;
    setSequencerBpm: (bpm: number) => void;
    setSequencerSteps: (steps: (string | null)[]) => void;
    setSequencerNumSteps: (numSteps: number) => void;
    _tickSequencer: () => void;
    
    // Property Sequencer Actions
    addPropertyTrack: (property: keyof ControlSettings) => void;
    removePropertyTrack: (trackId: string) => void;
    addKeyframe: (trackId: string, step: number) => void;
    updateKeyframeValue: (trackId: string, step: number, value: number) => void;
    removeKeyframe: (trackId: string, step: number) => void;

    // MIDI control
    connectMidi: () => void;
    selectMidiDevice: (deviceId: string) => void;
    startMidiLearning: (controlId: string) => void;
    _handleMidiMessage: (event: MIDIMessageEvent) => void;
    clearMidiError: () => void;
    
    // UI and Logs
    clearMidiLog: () => void;
    setViewportMode: (mode: 'horizontal' | 'vertical') => void;
    setRenderer: (renderer: string) => void;
}

// --- Helper Functions ---
const controlConfigs = {
  scaleSize: { min: 45, max: 400 },
  scaleSpacing: { min: -0.4, max: 2.0 },
  verticalOverlap: { min: -0.4, max: 2.0 },
  horizontalOffset: { min: 0, max: 1 },
  shapeMorph: { min: 0, max: 1 },
  scaleBorderWidth: { min: 0, max: 10 },
  animationSpeed: { min: 0.10, max: 2.50 },
  animationDirection: { min: 0, max: 360 },
  textureRotationSpeed: { min: -5, max: 5 },
};

const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;

// --- Zustand Store Definition ---

export const useTextureStore = createWithEqualityFn<State & Actions>((set, get): State & Actions => ({
    // --- Initial State ---
    project: null,
    activeSequenceIndex: 0,
    currentSettings: { // Default empty settings
        scaleSize: 150, scaleSpacing: 0, verticalOverlap: 0, horizontalOffset: 0.5, shapeMorph: 0,
        animationSpeed: 1, animationDirection: 90, textureRotation: 0, textureRotationSpeed: 0,
        scaleBorderColor: '#000000', scaleBorderWidth: 0, gradientColors: [],
        backgroundGradientColors: [{ id: 'bg-color-1', color: '#1f2937', hardStop: false }],
        concentric_repetitionSpeed: 0.5,
        concentric_growthSpeed: 0.5,
        concentric_initialSize: 10,
        concentric_gradientColors: [
          { "id": "c-color-1", "color": "#00ffff", "hardStop": false },
          { "id": "c-color-2", "color": "#ff00ff", "hardStop": false }
        ]
    },
    textureRotation: 0,
    isPatternDirty: false,
    selectedPatternId: null,
    learningPatternMidiNote: null,
    sequencerCurrentStep: 0,
    sequencerTimeoutId: null,
    sequencerStartTime: null,
    animationFrameRef: null,
    lastAppliedSettingsRef: null,
    previousGradient: null,
    previousBackgroundGradient: null,
    transitionProgress: 1,
    midi: {
        devices: [],
        selectedDeviceId: null,
        learningControl: null,
        noteOnTime: {},
        connectionError: null,
    },
    midiLog: [],
    viewportMode: 'horizontal',

    // --- Actions ---

    initializeProject: (project) => {
        const initialSettings = project.sequences[0].patterns[0]?.settings || get().currentSettings;
        set({
            project,
            textureRotation: initialSettings.textureRotation || 0,
            currentSettings: {
                ...get().currentSettings,
                ...initialSettings
            }
        });
        
        // Start texture rotation animation loop
        const animateRotation = () => {
            const speed = get().currentSettings.textureRotationSpeed;
            if (speed !== 0) {
                set(state => ({ textureRotation: (state.textureRotation + speed * 0.5) % 360 }));
            }
            requestAnimationFrame(animateRotation);
        };
        animateRotation();

        // Start sequencer if it's set to play
        if (project.globalSettings.isSequencerPlaying) {
            get()._tickSequencer();
        }
    },

    setProject: (project) => {
        set({ project });
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(project));
        } catch (e) {
            console.error("Failed to save project to localStorage", e);
        }
    },

    setActiveSequenceIndex: (index) => {
        set({ activeSequenceIndex: index });
    },
    
    updateActiveSequence: (updates) => {
        const project = get().project;
        if (!project) return;

        const newProject = produce(project, draft => {
            Object.assign(draft.sequences[get().activeSequenceIndex], updates);
        });
        get().setProject(newProject);
    },

    exportProject: () => {
        const project = get().project;
        if (!project) return;
        const jsonString = JSON.stringify(project, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `configuracion-escamas-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    importProject: (file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const text = e.target?.result as string;
              const data: Project = JSON.parse(text);
              if (!data.globalSettings || !data.sequences) throw new Error("Invalid project file");

              data.globalSettings.isSequencerPlaying = false;
              const settings = data.sequences[0]?.patterns[0]?.settings;
              
              set({
                  project: data,
                  activeSequenceIndex: 0,
                  currentSettings: {
                      ...get().currentSettings, // Keep defaults
                      ...settings, // Overwrite with loaded
                  },
                  selectedPatternId: null,
                  sequencerCurrentStep: 0,
              });
              alert("Configuración importada con éxito.");
          } catch (error) {
              alert(`Error al importar: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
      };
      reader.readAsText(file);
    },

    setCurrentSetting: <K extends keyof ControlSettings>(key: K, value: ControlSettings[K]) => {
        const { animationFrameRef } = get();
        // If a pattern loading animation is running, cancel it to give user control.
        if (animationFrameRef) {
            cancelAnimationFrame(animationFrameRef);
            // Reset transition state to prevent shaders from getting stuck.
            set({
                animationFrameRef: null,
                transitionProgress: 1,
                previousGradient: null,
                previousBackgroundGradient: null
            });
        }

        set(state => ({
            currentSettings: { ...state.currentSettings, [key]: value },
            isPatternDirty: !!state.selectedPatternId,
        }));
    },

    saveCurrentPattern: (midiNote) => {
        const { project, activeSequenceIndex, currentSettings } = get();
        if (!project) return;

        const newPattern: Pattern = {
            id: crypto.randomUUID(),
            name: `Memoria ${project.sequences[activeSequenceIndex].patterns.length + 1}`,
            settings: currentSettings,
            midiNote,
        };
        
        const newProject = produce(project, draft => {
            draft.sequences[activeSequenceIndex].patterns.push(newPattern);
        });
        get().setProject(newProject);
        set({ selectedPatternId: newPattern.id, isPatternDirty: false });
    },

    overwriteSelectedPattern: () => {
        const { project, selectedPatternId, currentSettings, activeSequenceIndex } = get();
        if (!project || !selectedPatternId) return;

        const newProject = produce(project, draft => {
            const pattern = draft.sequences[activeSequenceIndex].patterns.find(p => p.id === selectedPatternId);
            if (pattern) {
                pattern.settings = currentSettings;
            }
        });
        get().setProject(newProject);
        set({ isPatternDirty: false });
    },

    loadPattern: (id) => {
        const { project, activeSequenceIndex, currentSettings, animationFrameRef, lastAppliedSettingsRef } = get();
        if (!project) return;

        const activeSequence = project.sequences[activeSequenceIndex];
        const pattern = activeSequence.patterns.find(p => p.id === id);
        if (!pattern) return;

        // DEBUG: Log pattern load start
        if ((window as any).__DEBUG_SEQUENCER) {
            console.log('[PATTERN LOAD START]', {
                timestamp: Date.now(),
                patternId: id,
                patternName: pattern.name,
                hadActiveAnimation: animationFrameRef !== null,
                interpolationSpeed: activeSequence.interpolationSpeed,
                animateOnlyChanges: activeSequence.animateOnlyChanges,
            });
        }

        if (animationFrameRef) cancelAnimationFrame(animationFrameRef);

        const endSettings = { ...currentSettings, ...pattern.settings };
        const startSettings = { ...currentSettings }; // Create a stable copy for the animation.
        const baseSettings = lastAppliedSettingsRef || startSettings;

        const settingsToApply: Partial<ControlSettings> = activeSequence.animateOnlyChanges
            ? Object.fromEntries(Object.entries(endSettings).filter(([key, value]) =>
                JSON.stringify(value) !== JSON.stringify(baseSettings[key as keyof ControlSettings])
            ))
            : endSettings;

        const duration = activeSequence.interpolationSpeed * 1000;

        if (duration === 0) {
            set({
                currentSettings: endSettings,
                lastAppliedSettingsRef: endSettings,
                previousGradient: null,
                previousBackgroundGradient: null,
                transitionProgress: 1,
                selectedPatternId: id,
                isPatternDirty: false
            });
            return;
        }

        const gradientChanged = 'gradientColors' in settingsToApply;
        const backgroundGradientChanged = 'backgroundGradientColors' in settingsToApply;
        const concentricGradientChanged = 'concentric_gradientColors' in settingsToApply;

        set({
            previousGradient: gradientChanged ? startSettings.gradientColors : null,
            previousBackgroundGradient: backgroundGradientChanged ? startSettings.backgroundGradientColors : null,
            transitionProgress: (gradientChanged || backgroundGradientChanged || concentricGradientChanged) ? 0 : 1,
            selectedPatternId: id,
            isPatternDirty: false
        });

        let startTime: number | null = null;
        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);

            if (gradientChanged || backgroundGradientChanged || concentricGradientChanged) {
                set({ transitionProgress: progress });
            }

            // Create new settings based on the stable startSettings, not the live store state.
            const newSettings = { ...startSettings };

            Object.entries(settingsToApply).forEach(([key, value]) => {
                const settingKey = key as keyof ControlSettings;

                if (settingKey === 'gradientColors' || settingKey === 'backgroundGradientColors' || settingKey === 'concentric_gradientColors') {
                    if (progress >= 1 && Array.isArray(value)) {
                        (newSettings[settingKey]) = value;
                    }
                    return;
                }

                if (typeof startSettings[settingKey] === 'number' && typeof value === 'number') {
                    (newSettings[settingKey] as number) = lerp(startSettings[settingKey] as number, value, progress);
                } else if (progress >= 1) { // Apply non-numeric values at the end of the transition.
                    (newSettings[settingKey] as any) = value;
                }
            });

            set({ currentSettings: newSettings });

            if (progress < 1) {
                set({ animationFrameRef: requestAnimationFrame(animate) });
            } else {
                set({
                    animationFrameRef: null,
                    lastAppliedSettingsRef: endSettings,
                    currentSettings: endSettings, // Ensure the final state is exact.
                    previousGradient: null,
                    previousBackgroundGradient: null,
                    transitionProgress: 1
                });
            }
        };
        set({ animationFrameRef: requestAnimationFrame(animate) });
    },

    deletePattern: (id) => {
        const { project, activeSequenceIndex, selectedPatternId } = get();
        if (!project) return;
        
        const newProject = produce(project, draft => {
            const seq = draft.sequences[activeSequenceIndex];
            seq.patterns = seq.patterns.filter(p => p.id !== id);
            seq.sequencer.steps = seq.sequencer.steps.map(step => step === id ? null : step);
        });
        
        get().setProject(newProject);
        if (selectedPatternId === id) set({ selectedPatternId: null, isPatternDirty: false });
    },

    startLearningPatternNote: (patternId) => {
        set(state => ({ learningPatternMidiNote: state.learningPatternMidiNote === patternId ? null : patternId }));
    },
    
    clearPatternMidiAssignment: (patternId) => {
        const { project, activeSequenceIndex } = get();
        if (!project) return;
        const newProject = produce(project, draft => {
            const pattern = draft.sequences[activeSequenceIndex].patterns.find(p => p.id === patternId);
            if (pattern) delete pattern.midiNote;
        });
        get().setProject(newProject);
    },

    // --- Sequencer ---
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
                sequencerStartTime: Date.now(),  // Track start time for precise timing
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
        const { project, activeSequenceIndex, selectedPatternId } = get();
        if (!project || !project.globalSettings.isSequencerPlaying) return;
        
        const activeSequence = project.sequences[activeSequenceIndex];
        const { sequencer } = activeSequence;
        const numSteps = sequencer.numSteps;
        
        const nextStep = (get().sequencerCurrentStep + 1) % numSteps;
        set({ sequencerCurrentStep: nextStep });
        
        const patternIdToLoad = sequencer.steps[nextStep];
        
        // DEBUG: Log sequencer tick
        if ((window as any).__DEBUG_SEQUENCER) {
            console.log('[SEQUENCER TICK]', {
                timestamp: Date.now(),
                step: nextStep,
                patternIdToLoad,
                currentPatternId: selectedPatternId,
                willLoadPattern: patternIdToLoad && patternIdToLoad !== selectedPatternId,
            });
        }
        
        // --- 1. Load base pattern if it changes ---
        if (patternIdToLoad && patternIdToLoad !== selectedPatternId) {
            get().loadPattern(patternIdToLoad);
        }

        // --- 2. Calculate and apply property automation ---
        const basePattern = activeSequence.patterns.find(p => p.id === (patternIdToLoad || selectedPatternId));
        
        // Start with the last applied settings to avoid jumps when automation starts/stops
        let automatedSettings = { ...get().currentSettings, ...(basePattern?.settings || {}) };

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
                    
                    if (stepDiff < 0) { // Loop around
                        stepDiff += numSteps;
                        if (progress < 0) progress += numSteps;
                    }
                    const t = progress / stepDiff;
                    interpolatedValue = lerp(prevKeyframe.value, nextKeyframe.value, t);
                }

                if (sliderConfigs && sliderConfigs[track.property]) {
                     (automatedSettings as any)[track.property] = interpolatedValue;
                }
            });
        }
        
        // DEBUG: Log property automation results
        if ((window as any).__DEBUG_SEQUENCER && propertyTracks && propertyTracks.length > 0) {
            const automatedProps = propertyTracks.map(track => ({
                property: track.property,
                value: (automatedSettings as any)[track.property],
            }));
            console.log('[PROPERTY AUTOMATION]', {
                timestamp: Date.now(),
                step: nextStep,
                tracksCount: propertyTracks.length,
                automatedProps,
            });
        }
        
        // CRITICAL FIX: Don't overwrite settings if a pattern animation is in progress
        // This prevents race conditions between RAF interpolation and sequencer updates
        const { animationFrameRef } = get();
        if (animationFrameRef !== null) {
            // Pattern animation is running, skip settings update but still schedule next tick
            if ((window as any).__DEBUG_SEQUENCER) {
                console.log('[SETTINGS UPDATE SKIPPED]', {
                    timestamp: Date.now(),
                    step: nextStep,
                    reason: 'Pattern animation in progress',
                });
            }
        } else {
            // No animation running, safe to update settings
            set({ 
                currentSettings: automatedSettings,
                lastAppliedSettingsRef: automatedSettings, // Update ref for smooth transitions
            });
            
            // DEBUG: Log settings update
            if ((window as any).__DEBUG_SEQUENCER) {
                console.log('[SETTINGS UPDATED]', {
                    timestamp: Date.now(),
                    step: nextStep,
                    settingsHash: JSON.stringify(automatedSettings).substring(0, 50) + '...',
                });
            }
        }
        
        // Calculate next tick using precise timing to avoid drift
        const { sequencerStartTime } = get();
        const stepDuration = (60 / sequencer.bpm) * 1000 / 4;  // Duration of one 16th note in ms
        const nextStepNumber = nextStep + 1;  // Next step to execute
        
        if (sequencerStartTime) {
            // Calculate when the next step SHOULD occur (ideal time)
            const idealNextTime = sequencerStartTime + (nextStepNumber * stepDuration);
            const now = Date.now();
            const delay = Math.max(0, idealNextTime - now);  // Adjust for any drift
            
            if ((window as any).__DEBUG_SEQUENCER) {
                console.log('[SEQUENCER TIMING]', {
                    now,
                    idealNextTime,
                    delay,
                    drift: now - (sequencerStartTime + (nextStep * stepDuration)),
                });
            }
            
            const timeoutId = window.setTimeout(get()._tickSequencer, delay);
            set({ sequencerTimeoutId: timeoutId });
        } else {
            // Fallback to simple interval (shouldn't happen but safety check)
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
    
    // --- Property Sequencer Actions ---
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


    // --- MIDI ---
    connectMidi: async () => {
        if (!navigator.requestMIDIAccess) {
            set(state => ({ midi: { ...state.midi, connectionError: "La API de Web MIDI no es compatible con este navegador." } }));
            return;
        }
        try {
            const midiAccess = await navigator.requestMIDIAccess();
            const inputs = Array.from(midiAccess.inputs.values());
            set(state => ({ midi: { ...state.midi, devices: inputs, connectionError: null } }));
        } catch (error) {
            console.error("Could not access MIDI devices.", error);
            let errorMessage = "No se pudo conectar a los dispositivos MIDI. Inténtalo de nuevo.";
            if (error instanceof Error && error.name === 'SecurityError') {
                errorMessage = "El permiso para acceder a MIDI fue denegado. Por favor, revisa los permisos del sitio en la barra de direcciones de tu navegador y permite el acceso a MIDI.";
            }
            set(state => ({ midi: { ...state.midi, connectionError: errorMessage } }));
        }
    },
    
    clearMidiError: () => {
        set(state => ({ midi: { ...state.midi, connectionError: null } }));
    },

    selectMidiDevice: (deviceId) => {
        const { midi } = get();
        const currentDevice = midi.devices.find(d => d.id === midi.selectedDeviceId);
        if (currentDevice) currentDevice.removeEventListener('midimessage', get()._handleMidiMessage);

        const newDevice = midi.devices.find(d => d.id === deviceId);
        if (newDevice) {
            newDevice.addEventListener('midimessage', get()._handleMidiMessage);
            set(state => ({ midi: { ...state.midi, selectedDeviceId: deviceId } }));
        } else {
            set(state => ({ midi: { ...state.midi, selectedDeviceId: null } }));
        }
    },
    
    startMidiLearning: (controlId) => {
        set(state => ({
            midi: {
                ...state.midi,
                learningControl: state.midi.learningControl === controlId ? null : controlId,
            }
        }));
    },
    
    _handleMidiMessage: (event) => {
        const [status, data1, data2] = event.data;
        if (status === 248) return; // Ignore timing clock messages

        set(state => ({ midiLog: [{ data: Array.from(event.data), timeStamp: Math.round(event.timeStamp) }, ...state.midiLog].slice(0, 100) }));

        const command = status & 0xF0;
        
        // Note On
        if (command === 144 && data2 > 0) {
            set(state => ({ midi: { ...state.midi, noteOnTime: { ...state.midi.noteOnTime, [data1]: event.timeStamp } } }));
        }
        // Note Off
        else if (command === 128 || (command === 144 && data2 === 0)) {
            const startTime = get().midi.noteOnTime[data1];
            if (startTime) {
                const duration = event.timeStamp - startTime;
                
                // --- Pattern Triggering/Learning Logic ---
                if (duration > 500) { // Long press
                    get().saveCurrentPattern(data1);
                } else { // Short press
                    const { learningPatternMidiNote, project, activeSequenceIndex } = get();
                    if (learningPatternMidiNote) { // Assign note to pattern
                        const newProject = produce(project!, draft => {
                            const pattern = draft.sequences[activeSequenceIndex].patterns.find(p => p.id === learningPatternMidiNote);
                            if (pattern) pattern.midiNote = data1;
                        });
                        get().setProject(newProject);
                        set({ learningPatternMidiNote: null });
                    } else { // Load pattern
                        const patternToLoad = project?.sequences[activeSequenceIndex].patterns.find(p => p.midiNote === data1);
                        if (patternToLoad) get().loadPattern(patternToLoad.id);
                    }
                }
                
                set(state => {
                    const newNoteOnTime = { ...state.midi.noteOnTime };
                    delete newNoteOnTime[data1];
                    return { midi: { ...state.midi, noteOnTime: newNoteOnTime } };
                });
            }
        }
        // Control Change
        else if (command === 176) {
            const controller = data1;
            const value = data2;
            const { midi: { learningControl }, project } = get();
            
            if (learningControl) { // Learn a new mapping
                const newProject = produce(project!, draft => {
                    draft.globalSettings.midiMappings[learningControl] = controller;
                });
                get().setProject(newProject);
                set(state => ({ midi: { ...state.midi, learningControl: null } }));
            } else { // Apply an existing mapping
                const controlId = Object.keys(project!.globalSettings.midiMappings).find(
                    key => project!.globalSettings.midiMappings[key] === controller
                );
                if (controlId) {
                    const config = controlConfigs[controlId as keyof typeof controlConfigs];
                    if(config) {
                        const scaledValue = config.min + (value / 127) * (config.max - config.min);
                        get().setCurrentSetting(controlId as keyof ControlSettings, scaledValue);
                    }
                }
            }
        }
    },
    
    // --- UI and Logs ---
    clearMidiLog: () => set({ midiLog: [] }),
    setViewportMode: (mode) => set({ viewportMode: mode }),
    setRenderer: (renderer) => {
        const { project } = get();
        if (!project) return;

        const newProject = produce(project, draft => {
            draft.globalSettings.renderer = renderer;
        });
        get().setProject(newProject);
    },
}), shallow);