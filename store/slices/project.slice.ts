import { produce } from 'immer';
import type { StateCreator } from 'zustand';
import type { StoreState, ProjectActions } from '../types';
import type { Project, Sequence } from '../../types';
import { LOCAL_STORAGE_KEY } from '../utils/helpers';

export const createProjectSlice: StateCreator<StoreState, [], [], ProjectActions> = (set, get) => ({
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

    saveNewSequence: (name) => {
        const project = get().project;
        if (!project) return;

        const activeSequence = project.sequences[get().activeSequenceIndex];
        const newSequence: Sequence = {
            id: `seq_${Date.now()}`,
            name,
            interpolationSpeed: 500,
            animateOnlyChanges: true,
            sequencer: {
                steps: Array(16).fill(null),
                bpm: 120,
                numSteps: 16,
                propertyTracks: []
            },
            patterns: activeSequence?.patterns || []
        };

        const newProject = produce(project, draft => {
            draft.sequences.push(newSequence);
        });

        get().setProject(newProject);
        get().setActiveSequenceIndex(newProject.sequences.length - 1);
    },

    deleteSequence: (sequenceId) => {
        const project = get().project;
        if (!project || project.sequences.length <= 1) return;

        const sequenceIndex = project.sequences.findIndex(s => s.id === sequenceId);
        if (sequenceIndex === -1) return;

        const newProject = produce(project, draft => {
            draft.sequences.splice(sequenceIndex, 1);
        });

        const newActiveIndex = Math.min(get().activeSequenceIndex, newProject.sequences.length - 1);
        get().setProject(newProject);
        get().setActiveSequenceIndex(newActiveIndex);
    },

    duplicateSequence: (sequenceId, newName) => {
        const project = get().project;
        if (!project) return;

        const sequenceIndex = project.sequences.findIndex(s => s.id === sequenceId);
        if (sequenceIndex === -1) return;

        const sourcSequence = project.sequences[sequenceIndex];
        const duplicatedSequence: Sequence = {
            ...JSON.parse(JSON.stringify(sourcSequence)),
            id: `seq_${Date.now()}`,
            name: newName
        };

        const newProject = produce(project, draft => {
            draft.sequences.push(duplicatedSequence);
        });

        get().setProject(newProject);
        get().setActiveSequenceIndex(newProject.sequences.length - 1);
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
                      ...get().currentSettings,
                      ...settings,
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
});
