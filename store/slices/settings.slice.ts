import { produce } from 'immer';
import type { StateCreator } from 'zustand';
import type { StoreState, SettingsActions } from '../types';
import type { ControlSettings, Pattern } from '../../types';
import { lerp } from '../utils/helpers';
import { env } from '../../config';

export const createSettingsSlice: StateCreator<StoreState, [], [], SettingsActions> = (set, get) => ({
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
        if (env.debug.animation) {
            console.log('[ANIMATION] Pattern load start', {
                timestamp: Date.now(),
                patternId: id,
                patternName: pattern.name,
                hadActiveAnimation: animationFrameRef !== null,
                interpolationSpeed: activeSequence.interpolationSpeed,
                animateOnlyChanges: activeSequence.animateOnlyChanges,
            });
        }

        if (animationFrameRef) cancelAnimationFrame(animationFrameRef);

        const startSettings = { ...currentSettings };
        const baseSettings = currentSettings;

        // Determine which properties need animation
        const settingsToAnimate: Partial<ControlSettings> = activeSequence.animateOnlyChanges
            ? Object.fromEntries(Object.entries(pattern.settings).filter(([key, value]) =>
                JSON.stringify(value) !== JSON.stringify(baseSettings[key as keyof ControlSettings])
            ))
            : pattern.settings;

        const endSettings = activeSequence.animateOnlyChanges
            ? { ...currentSettings, ...settingsToAnimate }
            : { ...currentSettings, ...pattern.settings };

        // DEBUG: Log animation settings
        if (env.debug.animation) {
            const comparisonDetails = Object.entries(pattern.settings).map(([key, patternValue]) => {
                const currentValue = baseSettings[key as keyof ControlSettings];
                const isDifferent = JSON.stringify(patternValue) !== JSON.stringify(currentValue);
                return {
                    property: key,
                    isDifferent,
                    patternValue: typeof patternValue === 'object' ? '[object]' : patternValue,
                    currentValue: typeof currentValue === 'object' ? '[object]' : currentValue,
                };
            });

            console.log('[ANIMATION] Settings analysis', {
                animateOnlyChanges: activeSequence.animateOnlyChanges,
                patternSettingsCount: Object.keys(pattern.settings).length,
                settingsToAnimateCount: Object.keys(settingsToAnimate).length,
                settingsToAnimate: Object.keys(settingsToAnimate),
                allPatternSettings: Object.keys(pattern.settings),
                comparisonDetails: comparisonDetails.filter(d => d.isDifferent),
                allComparisons: comparisonDetails,
            });
        }

        const duration = activeSequence.interpolationSpeed * 1000;

        // If duration is 0 OR there's nothing to animate, apply immediately
        if (duration === 0 || Object.keys(settingsToAnimate).length === 0) {
            if (env.debug.animation) {
                console.log('[ANIMATION] Immediate apply', {
                    reason: duration === 0 ? 'duration is 0' : 'no properties to animate',
                    patternId: id,
                });
            }
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

        const gradientChanged = 'gradientColors' in settingsToAnimate;
        const backgroundGradientChanged = 'backgroundGradientColors' in settingsToAnimate;
        const concentricGradientChanged = 'concentric_gradientColors' in settingsToAnimate;

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

            const newSettings = { ...endSettings };

            Object.entries(settingsToAnimate).forEach(([key, value]) => {
                const settingKey = key as keyof ControlSettings;

                if (settingKey === 'gradientColors' || settingKey === 'backgroundGradientColors' || settingKey === 'concentric_gradientColors') {
                    if (progress >= 1 && Array.isArray(value)) {
                        (newSettings[settingKey]) = value;
                    }
                    return;
                }

                if (typeof startSettings[settingKey] === 'number' && typeof value === 'number') {
                    (newSettings[settingKey] as number) = lerp(startSettings[settingKey] as number, value, progress);
                } else if (progress >= 1) {
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
                    currentSettings: endSettings,
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
});
