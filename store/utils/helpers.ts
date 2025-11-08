export const LOCAL_STORAGE_KEY = 'textureAppProject';

export const controlConfigs = {
  scaleSize: { min: 45, max: 400 },
  scaleSpacing: { min: -0.4, max: 2.0 },
  verticalOverlap: { min: -0.4, max: 2.0 },
  horizontalOffset: { min: 0, max: 1 },
  shapeMorph: { min: 0, max: 1 },
  scaleBorderWidth: { min: 0, max: 10 },
  animationSpeed: { min: 0.10, max: 2.50 },
  animationDirection: { min: 0, max: 360 },
  textureRotationSpeed: { min: -5, max: 5 },
};

export const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;
