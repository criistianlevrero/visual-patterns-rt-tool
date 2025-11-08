import { createWithEqualityFn } from 'zustand/traditional';
import { produce } from 'immer';
import { shallow } from 'zustand/shallow';
import { renderers } from './components/renderers';
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

// State for an active user-driven pattern transition
interface PatternTransitionState {
    isActive: boolean;
    startTime: number;
    duration: number;
    startSettings: ControlSettings | null;
    endSettings: ControlSettings | null;
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
    // Refs for animation state, kept outside reactive state
    lastAppliedSettingsRef: ControlSettings | null;
    previousGradient: GradientColor[] | null;
    previousBackgroundGradient: GradientColor[] | null;
    transitionProgress: number;
    patternTransition: PatternTransitionState;
    midi: MidiState;
    midiLog: MidiLogEntry[];
    viewportMode: 'default' | 'desktop' | 'mobile';
    areControlsLocked: boolean;
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
    setViewportMode: (mode: 'default' | 'desktop' | 'mobile') => void;
    setRenderer: (renderer: string) => void;
    setAreControlsLocked: (locked: boolean) => void;

    // Internal animation methods
    _masterAnimationLoop: (time: number) => void;
    _tickSequencer: () => void;
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

// --- Master Animation Loop Logic ---
// This is kept in a ref within the store's closure to avoid re-renders.
// It holds all the non-reactive state for the animation loop.
const _masterAnimationLoopRef = {
    ref: 0,
    lastTime: 0,
    sequencerClock: 0,
};

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
    lastAppliedSettingsRef: null,
    previousGradient: null,
    previousBackgroundGradient: null,
    transitionProgress: 1,
    patternTransition: {
        isActive: false,
        startTime: 0,
        duration: 0,
        startSettings: null,
        endSettings: null,
    },
    midi: {
        devices: [],
        selectedDeviceId: null,
        learningControl: null,
        noteOnTime: {},
        connectionError: null,
    },
    midiLog: [],
    viewportMode: 'default',
    areControlsLocked: false,

    // --- Actions ---

    initializeProject: (project) => {
        const initialSettings = project.sequences[0].patterns[0]?.settings || get().currentSettings;
        set({
            project,
            textureRotation: initialSettings.textureRotation || 0,
            currentSettings: {
                ...get().currentSettings,
                ...initialSettings
            },
            lastAppliedSettingsRef: initialSettings,
        });
        
        // Start the single master animation loop
        _masterAnimationLoopRef.lastTime = performance.now();
        _masterAnimationLoopRef.ref = requestAnimationFrame(get()._masterAnimationLoop);
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
        if (get().areControlsLocked) return;

        // If a pattern loading animation is running, cancel it to give user control.
        set(produce(draft => {
            draft.patternTransition.isActive = false;
            draft.transitionProgress = 1;
            draft.previousGradient = null;
            draft.previousBackgroundGradient = null;
            draft.currentSettings[key] = value;
            draft.isPatternDirty = !!draft.selectedPatternId;
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
        const { project, activeSequenceIndex, currentSettings, lastAppliedSettingsRef } = get();
        if (!project) return;

        const activeSequence = project.sequences[activeSequenceIndex];
        const pattern = activeSequence.patterns.find(p => p.id === id);
        if (!pattern) return;

        const endSettings = { ...currentSettings, ...pattern.settings };
        const startSettings = { ...currentSettings };
        
        const duration = activeSequence.interpolationSpeed * 1000;

        if (duration === 0) {
            set({
                currentSettings: endSettings,
                lastAppliedSettingsRef: endSettings,
                previousGradient: null,
                previousBackgroundGradient: null,
                transitionProgress: 1,
                selectedPatternId: id,
                isPatternDirty: false,
                patternTransition: { isActive: false, startTime: 0, duration: 0, startSettings: null, endSettings: null }
            });
            return;
        }

        const gradientChanged = JSON.stringify(startSettings.gradientColors) !== JSON.stringify(endSettings.gradientColors);
        const backgroundGradientChanged = JSON.stringify(startSettings.backgroundGradientColors) !== JSON.stringify(endSettings.backgroundGradientColors);
        const concentricGradientChanged = JSON.stringify(startSettings.concentric_gradientColors) !== JSON.stringify(endSettings.concentric_gradientColors);

        set({
            previousGradient: gradientChanged ? startSettings.gradientColors : null,
            previousBackgroundGradient: backgroundGradientChanged ? startSettings.backgroundGradientColors : null,
            transitionProgress: (gradientChanged || backgroundGradientChanged || concentricGradientChanged) ? 0 : 1,
            selectedPatternId: id,
            isPatternDirty: false,
            patternTransition: {
                isActive: true,
                startTime: performance.now(),
                duration,
                startSettings: startSettings,
                endSettings: endSettings
            }
        });
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
        const { project } = get();
        if (!project) return;
        
        const newProject = produce(project, draft => {
            draft.globalSettings.isSequencerPlaying = isPlaying;
        });
        get().setProject(newProject);

        if (isPlaying) {
            set({ sequencerCurrentStep: -1 }); // Reset to start on play
            _masterAnimationLoopRef.sequencerClock = 0;
        }
    },
    
    setSequencerCurrentStep: (step) => {
        set({ sequencerCurrentStep: step });
    },

    _masterAnimationLoop: (time) => {
        const dt = time - _masterAnimationLoopRef.lastTime;
        _masterAnimationLoopRef.lastTime = time;

        const state = get();
        const { project, activeSequenceIndex, patternTransition } = state;

        let sequencerTicked = false;
        
        // --- 1. Sequencer Update (Highest Priority) ---
        if (project?.globalSettings.isSequencerPlaying) {
            _masterAnimationLoopRef.sequencerClock += dt;
            const bpm = project.sequences[activeSequenceIndex].sequencer.bpm;
            const stepInterval = (60 / bpm) * 1000 / 4; // 16th notes
            
            if (_masterAnimationLoopRef.sequencerClock >= stepInterval) {
                _masterAnimationLoopRef.sequencerClock %= stepInterval;
                get()._tickSequencer(); // This performs its own atomic state update
                sequencerTicked = true;
            }
        }
        
        // --- 2. If Sequencer ticked, its state takes precedence. We only update rotation. ---
        if (sequencerTicked) {
            const { textureRotation, currentSettings: { textureRotationSpeed } } = get();
            const newRotation = (textureRotation + textureRotationSpeed * 0.05) % 360;
            set({ textureRotation: newRotation });
        } 
        // --- 3. Otherwise, run normal user-driven animations ---
        else {
            let nextState: Partial<State> = {};
            let newSettings = { ...state.currentSettings };

            // User-driven pattern transition
            if (patternTransition.isActive && patternTransition.startSettings && patternTransition.endSettings) {
                const elapsed = time - patternTransition.startTime;
                const progress = Math.min(elapsed / patternTransition.duration, 1);
                
                nextState.transitionProgress = progress;

                Object.entries(patternTransition.endSettings).forEach(([key, endValue]) => {
                    const settingKey = key as keyof ControlSettings;
                    const startValue = patternTransition.startSettings![settingKey];
                    
                    if (typeof startValue === 'number' && typeof endValue === 'number') {
                        (newSettings[settingKey] as number) = lerp(startValue, endValue, progress);
                    } else if (progress >= 1) {
                         (newSettings[settingKey] as any) = endValue;
                    }
                });

                if (progress >= 1) {
                    nextState.patternTransition = { ...patternTransition, isActive: false };
                    nextState.lastAppliedSettingsRef = patternTransition.endSettings;
                    nextState.previousGradient = null;
                    nextState.previousBackgroundGradient = null;
                }
            }

            // Texture rotation
            const newRotation = (state.textureRotation + newSettings.textureRotationSpeed * 0.05) % 360;

            set({
                ...nextState,
                currentSettings: newSettings,
                textureRotation: newRotation,
            });
        }
        
        _masterAnimationLoopRef.ref = requestAnimationFrame(get()._masterAnimationLoop);
    },
    
    _tickSequencer: () => {
        const { project, activeSequenceIndex, selectedPatternId } = get();
        if (!project) return;
        
        const activeSequence = project.sequences[activeSequenceIndex];
        const { sequencer, patterns } = activeSequence;
        const { numSteps, propertyTracks } = sequencer;
        
        const nextStep = (get().sequencerCurrentStep + 1) % numSteps;
        const patternIdToLoad = sequencer.steps[nextStep];
        
        const basePattern = patterns.find(p => p.id === patternIdToLoad) || patterns.find(p => p.id === selectedPatternId);
        if (!basePattern) {
            set({ sequencerCurrentStep: nextStep });
            return;
        }

        const finalSettingsForTick = { ...get().currentSettings, ...basePattern.settings };

        if (propertyTracks && propertyTracks.length > 0) {
            const sliderConfigs = Object.values(renderers)
                .flatMap(r => r.controlSchema)
                .flatMap(s => s.controls)
                .filter(c => c.type === 'slider')
                .reduce((acc, c: any) => { acc[c.id] = c; return acc; }, {} as Record<string, SliderControlConfig>);

            propertyTracks.forEach(track => {
                const sortedKeyframes = [...track.keyframes].sort((a, b) => a.step - b.step);
                if (sortedKeyframes.length === 0) return;

                const keyframesBefore = sortedKeyframes.filter(k => k.step <= nextStep);
                const prevKeyframe = keyframesBefore.length > 0 ? keyframesBefore[keyframesBefore.length - 1] : sortedKeyframes[sortedKeyframes.length - 1];

                const keyframesAfter = sortedKeyframes.filter(k => k.step > nextStep);
                const nextKeyframe = keyframesAfter.length > 0 ? keyframesAfter[0] : sortedKeyframes[0];
                
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
                    const t = stepDiff > 0 ? progress / stepDiff : 1;
                    interpolatedValue = lerp(prevKeyframe.value, nextKeyframe.value, t);
                }

                if (sliderConfigs[track.property]) {
                     (finalSettingsForTick as any)[track.property] = interpolatedValue;
                }
            });
        }
        
        // Atomically update the state for this tick, overriding any user transition
        set({
            currentSettings: finalSettingsForTick,
            selectedPatternId: basePattern.id,
            isPatternDirty: false,
            lastAppliedSettingsRef: finalSettingsForTick,
            transitionProgress: 1,
            patternTransition: { isActive: false, startTime: 0, duration: 0, startSettings: null, endSettings: null },
            previousGradient: null,
            previousBackgroundGradient: null,
            sequencerCurrentStep: nextStep,
        });
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
                
                if (duration > 500) {
                    get().saveCurrentPattern(data1);
                } else {
                    const { learningPatternMidiNote, project, activeSequenceIndex } = get();
                    if (learningPatternMidiNote) {
                        const newProject = produce(project!, draft => {
                            const pattern = draft.sequences[activeSequenceIndex].patterns.find(p => p.id === learningPatternMidiNote);
                            if (pattern) pattern.midiNote = data1;
                        });
                        get().setProject(newProject);
                        set({ learningPatternMidiNote: null });
                    } else {
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
            
            if (learningControl) {
                const newProject = produce(project!, draft => {
                    draft.globalSettings.midiMappings[learningControl] = controller;
                });
                get().setProject(newProject);
                set(state => ({ midi: { ...state.midi, learningControl: null } }));
            } else {
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
    setAreControlsLocked: (locked) => set({ areControlsLocked: locked }),
}), shallow);
