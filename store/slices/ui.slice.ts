import { produce } from 'immer';
import type { StateCreator } from 'zustand';
import type { StoreState, UIActions } from '../types';

export const createUISlice: StateCreator<StoreState, [], [], UIActions> = (set, get) => ({
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
});
