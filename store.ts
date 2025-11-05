
import { createWithEqualityFn } from 'zustand/traditional';
import { produce } from 'immer';
import { shallow } from 'zustand/shallow';
import type { Project, ControlSettings, Pattern, GradientColor, MidiLogEntry } from './types';

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
    animationFrameRef: number | null;
    lastAppliedSettingsRef: ControlSettings | null;
    previousGradient: GradientColor[] | null;
    transitionProgress: number;
    midi: MidiState;
    midiLog: MidiLogEntry[];
    viewportMode: 'default' | 'desktop' | 'mobile';
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

    // MIDI control
    connectMidi: () => void;
    selectMidiDevice: (deviceId: string) => void;
    startMidiLearning: (controlId: string) => void;
    _handleMidiMessage: (event: MIDIMessageEvent) => void;
    clearMidiError: () => void;
    
    // UI and Logs
    clearMidiLog: () => void;
    setViewportMode: (mode: 'default' | 'desktop' | 'mobile') => void;
    setRenderer: (renderer: 'canvas2d' | 'webgl') => void;
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

// --- Zustand Store Definition ---

// FIX: Update to `createWithEqualityFn` and set `shallow` as the default equality function to resolve deprecation warning.
export const useTextureStore = createWithEqualityFn<State & Actions>((set, get): State & Actions => ({
    // --- Initial State ---
    project: null,
    activeSequenceIndex: 0,
    currentSettings: { // Default empty settings
        scaleSize: 150, scaleSpacing: 0, verticalOverlap: 0, horizontalOffset: 0.5, shapeMorph: 0,
        animationSpeed: 1, animationDirection: 90, textureRotation: 0, textureRotationSpeed: 0,
        scaleBorderColor: '#000000', scaleBorderWidth: 0, gradientColors: [],
    },
    textureRotation: 0,
    isPatternDirty: false,
    selectedPatternId: null,
    learningPatternMidiNote: null,
    sequencerCurrentStep: 0,
    sequencerTimeoutId: null,
    animationFrameRef: null,
    lastAppliedSettingsRef: null,
    previousGradient: null,
    transitionProgress: 1,
    midi: {
        devices: [],
        selectedDeviceId: null,
        learningControl: null,
        noteOnTime: {},
        connectionError: null,
    },
    midiLog: [],
    viewportMode: 'default',

    // --- Actions ---

    initializeProject: (project) => {
        set({
            project,
            currentSettings: project.sequences[0].patterns[0]?.settings || get().currentSettings,
            textureRotation: project.sequences[0].patterns[0]?.settings.textureRotation || 0,
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
              set({
                  project: data,
                  activeSequenceIndex: 0,
                  currentSettings: data.sequences[0]?.patterns[0]?.settings,
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

    // FIX: Add explicit types to the generic `setCurrentSetting` implementation to match the `Actions` interface.
    // This resolves a TypeScript inference issue that caused "Expected 0-1 arguments, but got 2" errors in multiple components.
    setCurrentSetting: <K extends keyof ControlSettings>(key: K, value: ControlSettings[K]) => {
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

        if (animationFrameRef) cancelAnimationFrame(animationFrameRef);
        
        const startSettings = currentSettings;
        const endSettings = pattern.settings;
        const baseSettings = lastAppliedSettingsRef || startSettings;
        
        const settingsToApply: Partial<ControlSettings> = activeSequence.animateOnlyChanges
            ? Object.fromEntries(Object.entries(endSettings).filter(([key, value]) =>
                JSON.stringify(value) !== JSON.stringify(baseSettings[key as keyof ControlSettings])
            ))
            : endSettings;
            
        const duration = activeSequence.interpolationSpeed * 1000;

        if (duration === 0) {
            set({ currentSettings: endSettings, lastAppliedSettingsRef: endSettings, previousGradient: null, transitionProgress: 1, selectedPatternId: id, isPatternDirty: false });
            return;
        }

        if ('gradientColors' in settingsToApply && settingsToApply.gradientColors) {
            set({ previousGradient: startSettings.gradientColors, transitionProgress: 0 });
        } else {
            set({ previousGradient: null, transitionProgress: 1 });
        }

        set({ selectedPatternId: id, isPatternDirty: false });

        let startTime: number | null = null;
        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            
            const newSettings = { ...get().currentSettings };

            if ('gradientColors' in settingsToApply) set({ transitionProgress: progress });

            Object.entries(settingsToApply).forEach(([key, value]) => {
                if (key === 'gradientColors') {
                    if (progress >= 1 && Array.isArray(value)) newSettings.gradientColors = value;
                    return;
                }
                const settingKey = key as keyof ControlSettings;
                if (typeof startSettings[settingKey] === 'number' && typeof value === 'number') {
                    (newSettings[settingKey] as number) = startSettings[settingKey] as number + (value - (startSettings[settingKey] as number)) * progress;
                } else if (progress >= 1 && typeof value === 'string') {
                    (newSettings[settingKey] as string) = value;
                }
            });
            
            set({ currentSettings: newSettings });

            if (progress < 1) {
                set({ animationFrameRef: requestAnimationFrame(animate) });
            } else {
                set({ animationFrameRef: null, lastAppliedSettingsRef: endSettings, currentSettings: { ...get().currentSettings, ...settingsToApply }, previousGradient: null, transitionProgress: 1 });
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
            set({ sequencerCurrentStep: -1 }); // Reset to start on play
            get()._tickSequencer();
        } else {
            set({ sequencerTimeoutId: null });
        }
    },
    
    setSequencerCurrentStep: (step) => {
        set({ sequencerCurrentStep: step });
    },
    
    _tickSequencer: () => {
        const { project, activeSequenceIndex } = get();
        if (!project || !project.globalSettings.isSequencerPlaying) return;
        
        const numSteps = project.sequences[activeSequenceIndex].sequencer.numSteps;
        const nextStep = (get().sequencerCurrentStep + 1) % numSteps;
        set({ sequencerCurrentStep: nextStep });
        
        const patternIdToLoad = project.sequences[activeSequenceIndex].sequencer.steps[nextStep];
        if (patternIdToLoad) get().loadPattern(patternIdToLoad);
        
        const interval = (60 / project.sequences[activeSequenceIndex].sequencer.bpm) * 1000 / 4;
        const timeoutId = window.setTimeout(get()._tickSequencer, interval);
        set({ sequencerTimeoutId: timeoutId });
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
            // FIX: Correctly destructure learningControl from the nested midi state object.
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
