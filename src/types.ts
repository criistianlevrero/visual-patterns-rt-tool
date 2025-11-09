import type React from 'react';

export interface GradientColor {
  id: string;
  color: string;
  hardStop: boolean;
}

export interface MidiLogEntry {
  data: number[];
  timeStamp: number;
}

export interface ControlSettings {
  // Scale renderer settings
  scaleSize: number;
  scaleSpacing: number;
  verticalOverlap: number;
  horizontalOffset: number;
  shapeMorph: number;
  animationSpeed: number;
  animationDirection: number;
  textureRotation: number;
  textureRotationSpeed: number;
  scaleBorderColor: string;
  scaleBorderWidth: number;
  gradientColors: GradientColor[];
  backgroundGradientColors: GradientColor[];
  
  // Concentric renderer settings
  concentric_repetitionSpeed?: number;
  concentric_growthSpeed?: number;
  concentric_initialSize?: number;
  concentric_gradientColors?: GradientColor[];
}

export interface Pattern {
    id: string;
    name: string;
    settings: ControlSettings;
    midiNote?: number;
}

// --- Animation System Types ---
export enum ControlSource {
  PatternSequencer = 0,  // Lowest priority
  PropertySequencer = 1,
  UI = 2,
  MIDI = 3               // Highest priority
}

export type InterpolationType = 'linear'; // Prepared for future expansion

export interface AnimationRequest {
  property: keyof ControlSettings;
  from: any;
  to: any;
  steps: number;              // 0 = immediate, >0 = animated
  source: ControlSource;
  interpolationType: InterpolationType;
}

export interface ActiveAnimation {
  request: AnimationRequest;
  currentFrame: number;
  totalFrames: number;
  startValue: any;
}

// --- New types for Property Sequencer ---
export interface Keyframe {
  step: number;
  value: number;
  interpolation: InterpolationType;
}

export interface PropertyTrack {
  id: string;
  property: keyof ControlSettings;
  keyframes: Keyframe[];
}

// --- Control Schema Types ---
export interface SliderControlConfig {
  type: 'slider';
  id: keyof ControlSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  formatter: (value: number) => string;
}

export interface CustomControlConfig {
  type: 'custom';
  id: string; // Unique ID for the control
  component: React.FC;
}

export type ControlConfig = SliderControlConfig | CustomControlConfig;

export interface ControlSection {
  title: string;
  defaultOpen?: boolean;
  controls: ControlConfig[];
}

export interface SequencerSettings {
  steps: (string | null)[];
  bpm: number;
  numSteps: number;
  propertyTracks: PropertyTrack[]; // Added for property sequencer
}

export interface Sequence {
    id:string;
    name: string;
    interpolationSpeed: number; // In steps (0-8), supports fractions. 0 = immediate. Will be converted to frames based on BPM
    sequencer: SequencerSettings;
    patterns: Pattern[];
}

export interface GlobalSettings {
    midiMappings: { [key: string]: number };
    isSequencerPlaying: boolean;
    renderer: string;
}

export interface Project {
    version: string; // Semantic versioning (e.g., "1.0.0")
    globalSettings: GlobalSettings;
    sequences: Sequence[];
}