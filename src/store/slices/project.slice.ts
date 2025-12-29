import { produce } from 'immer';
import type { StateCreator } from 'zustand';
import type { StoreState, ProjectActions } from '../types';
import type { Project, Sequence } from '../../types';
import { LOCAL_STORAGE_KEY } from '../utils/helpers';

export const createProjectSlice: StateCreator<StoreState, [], [], ProjectActions> = (set, get) => ({
    initializeProject: (project) => {
        // Validate project version
        const currentVersion = '2.0.0';
        const projectVersion = project.version || '1.0.0';
        
        if (projectVersion !== currentVersion) {
            console.warn(`[PROJECT] Version mismatch: project is v${projectVersion}, app expects v${currentVersion}`);
            
            // Migration logic for older versions
            if (!project.version || projectVersion === '1.0.0') {
                console.log('[PROJECT] Migrating from v1.0.0 to v2.0.0');
                
                // Migrate interpolationSpeed from ms to steps (rough conversion)
                project.sequences.forEach(seq => {
                    if (seq.interpolationSpeed > 10) {
                        // Old format was in ms (e.g., 500ms -> 2 steps)
                        seq.interpolationSpeed = Math.min(8, Math.max(0, seq.interpolationSpeed / 250));
                    }
                    // Remove animateOnlyChanges if it exists
                    delete (seq as any).animateOnlyChanges;
                });
                
                project.version = currentVersion;
                console.log('[PROJECT] Migration complete');
            }
        }
        
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
            interpolationSpeed: 2, // In steps (0-8, supports fractions)
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

    renameSequence: (sequenceId, newName) => {
        const project = get().project;
        if (!project) return;

        const sequenceIndex = project.sequences.findIndex(s => s.id === sequenceId);
        if (sequenceIndex === -1) return;

        const newProject = produce(project, draft => {
            draft.sequences[sequenceIndex].name = newName;
        });

        get().setProject(newProject);
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

    resetToDefault: async () => {
        try {
            const response = await fetch('/default-project.json');
            if (!response.ok) {
                throw new Error(`Failed to fetch default project: ${response.statusText}`);
            }
            const defaultProject: Project = await response.json();
            
            // Clear localStorage
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            
            // Reset to default state
            defaultProject.globalSettings.isSequencerPlaying = false;
            const defaultSettings = defaultProject.sequences[0]?.patterns[0]?.settings || get().currentSettings;
            
            set({
                project: defaultProject,
                activeSequenceIndex: 0,
                currentSettings: {
                    ...get().currentSettings,
                    ...defaultSettings,
                },
                selectedPatternId: null,
                sequencerCurrentStep: 0,
            });
            
            console.log('Project reset to default configuration.');
            alert('Proyecto reseteado a configuración por defecto.');
        } catch (error) {
            console.error('Failed to reset to default:', error);
            alert(`Error al resetear: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },
});
