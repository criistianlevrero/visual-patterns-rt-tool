import type { StateCreator } from 'zustand';
import type { StoreState, AnimationActions } from '../types';
import type { ControlSettings, ControlSource, AnimationRequest, ActiveAnimation } from '../../types';
import { lerp } from '../utils/helpers';
import { env } from '../../config';

export const createAnimationSlice: StateCreator<StoreState, [], [], AnimationActions> = (set, get) => ({
    requestPropertyChange: (property, from, to, steps, source, interpolationType = 'linear') => {
        const { activeAnimations, project, currentSettings } = get();
        
        // If from is not provided, use current value
        const startValue = from !== undefined ? from : currentSettings[property];
        
        // Check if there's an active animation for this property
        const existingAnimation = activeAnimations.get(property);
        
        if (existingAnimation) {
            // Check priority: only replace if new source has higher or equal priority
            if (source < existingAnimation.request.source) {
                if (env.debug.animation) {
                    console.log('[ANIMATION] Request ignored - lower priority', {
                        property,
                        existingSource: existingAnimation.request.source,
                        newSource: source,
                    });
                }
                return; // Ignore lower priority requests
            }
            
            if (env.debug.animation) {
                console.log('[ANIMATION] Canceling existing animation', {
                    property,
                    oldSource: existingAnimation.request.source,
                    newSource: source,
                });
            }
        }
        
        // Immediate change (steps = 0)
        if (steps === 0) {
            const newAnimations = new Map(activeAnimations);
            newAnimations.delete(property);
            
            set({ 
                activeAnimations: newAnimations,
                currentSettings: { ...currentSettings, [property]: to }
            });
            
            if (env.debug.animation) {
                console.log('[ANIMATION] Immediate change', {
                    property,
                    from: startValue,
                    to,
                    source,
                });
            }
            
            return;
        }
        
        // Calculate total frames based on BPM
        const bpm = project?.sequences[get().activeSequenceIndex]?.sequencer.bpm || 120;
        const beatsPerSecond = bpm / 60;
        const stepsPerBeat = 4; // Assuming 16th note resolution
        const stepsPerSecond = beatsPerSecond * stepsPerBeat;
        const secondsPerStep = 1 / stepsPerSecond;
        const fps = 60; // Target frame rate
        const framesPerStep = Math.max(1, Math.round(secondsPerStep * fps));
        const totalFrames = Math.max(1, Math.round(steps * framesPerStep)); // Ensure at least 1 frame and integer value
        
        const request: AnimationRequest = {
            property,
            from: startValue,
            to,
            steps,
            source,
            interpolationType,
        };
        
        const animation: ActiveAnimation = {
            request,
            currentFrame: 0,
            totalFrames,
            startValue,
        };
        
        const newAnimations = new Map(activeAnimations);
        newAnimations.set(property, animation);
        
        // Initialize gradient transition state if animating a gradient
        const isGradient = property === 'gradientColors' || 
                         property === 'backgroundGradientColors' || 
                         property === 'concentric_gradientColors';
        
        if (isGradient && Array.isArray(startValue)) {
            if (property === 'gradientColors') {
                set({ 
                    activeAnimations: newAnimations,
                    previousGradient: startValue,
                    transitionProgress: 0,
                });
            } else if (property === 'backgroundGradientColors') {
                set({ 
                    activeAnimations: newAnimations,
                    previousBackgroundGradient: startValue,
                    transitionProgress: 0,
                });
            } else {
                set({ 
                    activeAnimations: newAnimations,
                    transitionProgress: 0,
                });
            }
        } else {
            set({ activeAnimations: newAnimations });
        }
        
        if (env.debug.animation) {
            console.log('[ANIMATION] Animation started', {
                property,
                from: startValue,
                to,
                steps,
                totalFrames,
                framesPerStep,
                source,
                bpm,
                isGradient,
            });
        }
        
        // Start RAF loop if not already running
        if (activeAnimations.size === 0) {
            get()._animationLoop();
        }
    },
    
    _animationLoop: () => {
        const { activeAnimations, currentSettings } = get();
        
        if (activeAnimations.size === 0) {
            return; // Stop loop if no animations
        }
        
        const newSettings = { ...currentSettings };
        const newAnimations = new Map(activeAnimations);
        let hasChanges = false;
        
        // Track gradient animations for shader transition
        let hasGradientAnimation = false;
        let maxGradientProgress = 0;
        
        // Process each active animation
        activeAnimations.forEach((animation, property) => {
            animation.currentFrame++;
            const progress = Math.min(animation.currentFrame / animation.totalFrames, 1);
            
            // Interpolate value based on type
            let newValue: any;
            const { from, to } = animation.request;
            
            if (animation.request.interpolationType === 'linear') {
                if (typeof from === 'number' && typeof to === 'number') {
                    newValue = lerp(from, to, progress);
                } else if (Array.isArray(from) && Array.isArray(to)) {
                    // For arrays (like gradients), track animation progress for shader
                    const isGradient = property === 'gradientColors' || 
                                     property === 'backgroundGradientColors' || 
                                     property === 'concentric_gradientColors';
                    
                    if (isGradient) {
                        hasGradientAnimation = true;
                        maxGradientProgress = Math.max(maxGradientProgress, progress);
                        
                        // Set target gradient immediately (shader will interpolate)
                        newValue = to;
                        
                        // Update previous gradient and transition progress on first frame
                        if (animation.currentFrame === 1) {
                            if (property === 'gradientColors') {
                                set({ previousGradient: from });
                            } else if (property === 'backgroundGradientColors') {
                                set({ previousBackgroundGradient: from });
                            }
                        }
                    } else {
                        // Non-gradient arrays: set target immediately
                        newValue = to;
                    }
                } else {
                    // For other types (strings, etc.), set target immediately
                    newValue = to;
                }
            }
            
            (newSettings as any)[property] = newValue;
            hasChanges = true;
            
            // Remove animation if complete
            if (progress >= 1) {
                newAnimations.delete(property);
                
                if (env.debug.animation) {
                    console.log('[ANIMATION] Animation completed', {
                        property,
                        finalValue: newValue,
                        source: animation.request.source,
                    });
                }
            }
        });
        
        // Update gradient transition progress
        if (hasGradientAnimation) {
            set({ transitionProgress: maxGradientProgress });
        }
        
        if (hasChanges) {
            set({ 
                currentSettings: newSettings,
                activeAnimations: newAnimations,
            });
        }
        
        // Clean up gradient transition state when all gradient animations complete
        if (!hasGradientAnimation && (get().previousGradient !== null || get().previousBackgroundGradient !== null)) {
            set({
                previousGradient: null,
                previousBackgroundGradient: null,
                transitionProgress: 1,
            });
        }
        
        // Continue loop if there are still active animations
        if (newAnimations.size > 0) {
            requestAnimationFrame(() => get()._animationLoop());
        }
    },
    
    cancelAllAnimations: () => {
        set({ activeAnimations: new Map() });
        
        if (env.debug.animation) {
            console.log('[ANIMATION] All animations canceled');
        }
    },
    
    cancelAnimationForProperty: (property) => {
        const { activeAnimations } = get();
        const newAnimations = new Map(activeAnimations);
        newAnimations.delete(property);
        set({ activeAnimations: newAnimations });
        
        if (env.debug.animation) {
            console.log('[ANIMATION] Animation canceled for property', { property });
        }
    },
});
