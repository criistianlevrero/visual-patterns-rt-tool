import { createWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import type { StoreState, State } from './types';
import { createProjectSlice } from './slices/project.slice';
import { createSettingsSlice } from './slices/settings.slice';
import { createSequencerSlice } from './slices/sequencer.slice';
import { createMidiSlice } from './slices/midi.slice';
import { createUISlice } from './slices/ui.slice';

// --- Initial State ---
const initialState: State = {
    project: null,
    activeSequenceIndex: 0,
    currentSettings: {
        scaleSize: 150,
        scaleSpacing: 0,
        verticalOverlap: 0,
        horizontalOffset: 0.5,
        shapeMorph: 0,
        animationSpeed: 1,
        animationDirection: 90,
        textureRotation: 0,
        textureRotationSpeed: 0,
        scaleBorderColor: '#000000',
        scaleBorderWidth: 0,
        gradientColors: [],
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
};

// --- Store Creation ---
export const useTextureStore = createWithEqualityFn<StoreState>(
    (set, get, api) => ({
        ...initialState,
        ...createProjectSlice(set, get, api),
        ...createSettingsSlice(set, get, api),
        ...createSequencerSlice(set, get, api),
        ...createMidiSlice(set, get, api),
        ...createUISlice(set, get, api),
    }),
    shallow
);
