
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
}

export interface Pattern {
    id: string;
    name: string;
    settings: ControlSettings;
    midiNote?: number;
}

export interface SequencerSettings {
  steps: (string | null)[];
  bpm: number;
  numSteps: number;
}

export interface Sequence {
    id: string;
    name: string;
    interpolationSpeed: number;
    animateOnlyChanges: boolean;
    sequencer: SequencerSettings;
    patterns: Pattern[];
}

export interface GlobalSettings {
    midiMappings: { [key: string]: number };
    isSequencerPlaying: boolean;
    renderer: 'canvas2d' | 'webgl';
}

export interface Project {
    globalSettings: GlobalSettings;
    sequences: Sequence[];
}
