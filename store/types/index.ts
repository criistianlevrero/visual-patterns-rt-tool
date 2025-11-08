import type { Project, ControlSettings, Pattern, Sequence, MidiLogEntry } from '../../types';

export interface MidiState {
    devices: MIDIInput[];
    selectedDeviceId: string | null;
    learningControl: string | null;
    noteOnTime: { [key: number]: number };
    connectionError: string | null;
}

export interface State {
    project: Project | null;
    activeSequenceIndex: number;
    currentSettings: ControlSettings;
    textureRotation: number;
    isPatternDirty: boolean;
    selectedPatternId: string | null;
    learningPatternMidiNote: string | null;
    sequencerCurrentStep: number;
    sequencerTimeoutId: number | null;
    sequencerStartTime: number | null;
    animationFrameRef: number | null;
    lastAppliedSettingsRef: ControlSettings | null;
    previousGradient: any[] | null;
    previousBackgroundGradient: any[] | null;
    transitionProgress: number;
    midi: MidiState;
    midiLog: MidiLogEntry[];
    viewportMode: 'horizontal' | 'vertical';
}

export interface ProjectActions {
    initializeProject: (project: Project) => void;
    setProject: (project: Project) => void;
    setActiveSequenceIndex: (index: number) => void;
    updateActiveSequence: (updates: Partial<Sequence>) => void;
    saveNewSequence: (name: string) => void;
    deleteSequence: (sequenceId: string) => void;
    duplicateSequence: (sequenceId: string, newName: string) => void;
    exportProject: () => void;
    importProject: (file: File) => void;
}

export interface SettingsActions {
    setCurrentSetting: <K extends keyof ControlSettings>(key: K, value: ControlSettings[K]) => void;
    saveCurrentPattern: (midiNote?: number) => void;
    overwriteSelectedPattern: () => void;
    loadPattern: (id: string) => void;
    deletePattern: (id: string) => void;
    startLearningPatternNote: (patternId: string) => void;
    clearPatternMidiAssignment: (patternId: string) => void;
}

export interface SequencerActions {
    setIsSequencerPlaying: (isPlaying: boolean) => void;
    setSequencerCurrentStep: (step: number) => void;
    setSequencerBpm: (bpm: number) => void;
    setSequencerSteps: (steps: (string | null)[]) => void;
    setSequencerNumSteps: (numSteps: number) => void;
    _tickSequencer: () => void;
    addPropertyTrack: (property: keyof ControlSettings) => void;
    removePropertyTrack: (trackId: string) => void;
    addKeyframe: (trackId: string, step: number) => void;
    updateKeyframeValue: (trackId: string, step: number, value: number) => void;
    removeKeyframe: (trackId: string, step: number) => void;
}

export interface MidiActions {
    connectMidi: () => void;
    selectMidiDevice: (deviceId: string) => void;
    startMidiLearning: (controlId: string) => void;
    _handleMidiMessage: (event: MIDIMessageEvent) => void;
    clearMidiError: () => void;
}

export interface UIActions {
    clearMidiLog: () => void;
    setViewportMode: (mode: 'horizontal' | 'vertical') => void;
    setRenderer: (renderer: string) => void;
}

export type Actions = ProjectActions & SettingsActions & SequencerActions & MidiActions & UIActions;

export type StoreState = State & Actions;
