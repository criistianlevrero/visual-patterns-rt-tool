import { produce } from 'immer';
import type { StateCreator } from 'zustand';
import type { StoreState, MidiActions } from '../types';
import type { ControlSettings } from '../../types';
import { controlConfigs } from '../utils/helpers';

export const createMidiSlice: StateCreator<StoreState, [], [], MidiActions> = (set, get) => ({
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
});
