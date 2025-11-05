

import React, { useEffect, useRef } from 'react';
import { useTextureStore } from '../store';
import type { ControlSettings, GradientColor } from '../types';

type RGBColor = { r: number, g: number, b: number };

interface TextureCanvasProps {
  className?: string;
}

// --- Helper Functions ---

const hexToRgb = (hex: string): RGBColor | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};
    
const lerp = (a: number, b: number, amount: number): number => {
    return (1 - amount) * a + amount * b;
};

const lerpColor = (colorA: RGBColor, colorB: RGBColor, amount: number): RGBColor => {
    return {
        r: Math.round(lerp(colorA.r, colorB.r, amount)),
        g: Math.round(lerp(colorA.g, colorB.g, amount)),
        b: Math.round(lerp(colorA.b, colorB.b, amount)),
    };
};

const getCirclePoints = (radius: number, segments: number): number[][] => {
    const points: number[][] = [];
    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * 2 * Math.PI;
        points.push([
            radius * Math.cos(angle),
            radius * Math.sin(angle)
        ]);
    }
    return points;
};

const getSquarePoints = (radius: number, segments: number): number[][] => {
    const points: number[][] = [];
    const p = [ [0, -radius], [radius, 0], [0, radius], [-radius, 0] ];
    for(let i=0; i<4; i++) {
        const nextI = (i + 1) % 4;
        for(let j=0; j < segments / 4; j++) {
            const prog = j / (segments / 4);
            points.push([ lerp(p[i][0], p[nextI][0], prog), lerp(p[i][1], p[nextI][1], prog) ]);
        }
    }
    return points;
};

const getStarPoints = (radius: number, segments: number): number[][] => {
    const points: number[][] = [];
    const innerRadius = radius * 0.5;
    const numPoints = 4;
    const p = [];
     for (let i = 0; i < numPoints; i++) {
        const outerAngle = (i / numPoints) * 2 * Math.PI - Math.PI/2;
        const innerAngle = outerAngle + (Math.PI / numPoints);
        p.push([ radius * Math.cos(outerAngle), radius * Math.sin(outerAngle) ]);
        p.push([ innerRadius * Math.cos(innerAngle), innerRadius * Math.sin(innerAngle) ]);
    }
    for (let i = 0; i < p.length; i++) {
        const nextI = (i + 1) % p.length;
        for (let j = 0; j < Math.ceil(segments / p.length); j++) {
            const prog = j / Math.ceil(segments / p.length);
            points.push([ lerp(p[i][0], p[nextI][0], prog), lerp(p[i][1], p[nextI][1], prog) ]);
        }
    }
    return points;
};

const interpolatePoints = (pointsA: number[][], pointsB: number[][], amount: number): number[][] => {
    return pointsA.map((pA, i) => {
        const pB = pointsB[i];
        if (!pB) return pA;
        return [ lerp(pA[0], pB[0], amount), lerp(pA[1], pB[1], amount) ];
    });
};

const calculateScaleShapePoints = (size: number, shapeMorph: number): number[][] => {
    const radius = size / 2;
    if (radius <= 0) return [];
    
    const SEGMENTS = 32;
    const circlePoints = getCirclePoints(radius, SEGMENTS);
    const squarePoints = getSquarePoints(radius, SEGMENTS);
    const starPoints = getStarPoints(radius, SEGMENTS);
    
    if (shapeMorph <= 0.5) {
        return interpolatePoints(circlePoints, squarePoints, shapeMorph * 2);
    } else {
        return interpolatePoints(squarePoints, starPoints, (shapeMorph - 0.5) * 2);
    }
};

const TextureCanvas: React.FC<TextureCanvasProps> = ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const calculateColorFromGradient = (
        gradient: { rgb: RGBColor, hardStop: boolean }[], 
        animationValue: number
    ): RGBColor => {
        if (gradient.length === 0) return { r: 255, g: 255, b: 255 };
        if (gradient.length === 1) return gradient[0].rgb;

        const shouldLoop = gradient.length > 1 && !gradient[0].hardStop;
        const effectiveGradient = shouldLoop ? [...gradient, gradient[0]] : gradient;
        const numSegments = effectiveGradient.length - 1;

        if (numSegments <= 0) return gradient[0].rgb;

        const normalizedValue = (animationValue < 0 ? animationValue % 360 + 360 : animationValue % 360) / 360;
        
        const colorPosition = normalizedValue * numSegments;
        const startIndex = Math.floor(colorPosition);
        const endIndex = Math.min(startIndex + 1, effectiveGradient.length - 1);
        
        if (endIndex > 0 && effectiveGradient[endIndex].hardStop) {
            return effectiveGradient[startIndex].rgb;
        }
        
        const amount = colorPosition - startIndex;
        return lerpColor(effectiveGradient[startIndex].rgb, effectiveGradient[endIndex].rgb, amount);
    };

    const drawScene = (
        time: number, 
        settings: ControlSettings, 
        rotation: number, 
        prevGradient: GradientColor[] | null, 
        transProgress: number
    ) => {
        const {
            scaleSize, scaleSpacing, verticalOverlap, horizontalOffset, animationDirection,
            scaleBorderColor, scaleBorderWidth, gradientColors
        } = settings;

        const dpr = window.devicePixelRatio || 1;
        const displayWidth = canvas.offsetWidth;
        const displayHeight = canvas.offsetHeight;

        if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
            canvas.width = displayWidth * dpr;
            canvas.height = displayHeight * dpr;
            ctx.scale(dpr, dpr);
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#1f2937'; // bg-gray-800
        ctx.fillRect(0, 0, displayWidth, displayHeight);

        ctx.save();
        ctx.translate(displayWidth / 2, displayHeight / 2);
        ctx.rotate(rotation * Math.PI / 180);

        const radius = scaleSize / 2;
        const horizontalStep = radius + (scaleSize * scaleSpacing);
        const verticalStep = radius + (scaleSize * verticalOverlap);

        if (horizontalStep <= 0 || verticalStep <= 0) {
            ctx.restore();
            return;
        }

        // --- PERFORMANCE OPTIMIZATION: Use Path2D ---
        // 1. Calculate the shape points once per frame.
        const scaleShapePoints = calculateScaleShapePoints(settings.scaleSize, settings.shapeMorph);
        if (!scaleShapePoints.length) {
            ctx.restore();
            return;
        }
        
        // 2. Create a pre-compiled Path2D object from the points.
        const scalePath = new Path2D();
        scalePath.moveTo(scaleShapePoints[0][0], scaleShapePoints[0][1]);
        for(let i = 1; i < scaleShapePoints.length; i++) {
            scalePath.lineTo(scaleShapePoints[i][0], scaleShapePoints[i][1]);
        }
        scalePath.closePath();
        // --- END OPTIMIZATION ---

        const angleInRadians = animationDirection * (Math.PI / 180);
        const dirX = Math.cos(angleInRadians);
        const dirY = Math.sin(angleInRadians);
        const colorSpread = 15;
        
        const currentGradient = gradientColors.map(c => ({ rgb: hexToRgb(c.color), hardStop: c.hardStop })).filter((c): c is { rgb: RGBColor, hardStop: boolean } => c.rgb !== null);
        const previousRgbGradient = prevGradient ? prevGradient.map(c => ({ rgb: hexToRgb(c.color), hardStop: c.hardStop })).filter((c): c is { rgb: RGBColor, hardStop: boolean } => c.rgb !== null) : null;

        const renderSize = Math.max(displayWidth, displayHeight) * 1.5;
        const numRows = Math.ceil(renderSize / verticalStep) + 2;
        const numCols = Math.ceil(renderSize / horizontalStep) + 2;
        const startRow = -Math.ceil(numRows / 2);
        const endRow = Math.ceil(numRows / 2);
        const startCol = -Math.ceil(numCols / 2);
        const endCol = Math.ceil(numCols / 2);

        // Set border properties once outside the loop
        if (scaleBorderWidth > 0) {
            ctx.strokeStyle = scaleBorderColor;
            ctx.lineWidth = scaleBorderWidth;
        }

        for (let row = startRow; row < endRow; row++) {
            for (let col = startCol; col < endCol; col++) {
                const xOffset = row % 2 === 0 ? 0 : horizontalStep * horizontalOffset;
                const cx = col * horizontalStep + xOffset;
                const cy = row * verticalStep;

                const hueOffset = (col * dirX + row * dirY) * colorSpread;
                const animationValue = time + hueOffset;
                let finalColor: RGBColor;
                
                if (previousRgbGradient && transProgress < 1) {
                    const oldColor = calculateColorFromGradient(previousRgbGradient, animationValue);
                    const newColor = calculateColorFromGradient(currentGradient, animationValue);
                    finalColor = lerpColor(oldColor, newColor, transProgress);
                } else {
                    finalColor = calculateColorFromGradient(currentGradient, animationValue);
                }
                
                ctx.fillStyle = `rgb(${finalColor.r}, ${finalColor.g}, ${finalColor.b})`;
                
                // --- PERFORMANCE OPTIMIZATION: Use Path2D ---
                // 3. Translate to the scale's position and fill/stroke the pre-compiled path.
                ctx.save();
                ctx.translate(cx, cy);
                ctx.fill(scalePath);
                if (scaleBorderWidth > 0) {
                    ctx.stroke(scalePath);
                }
                ctx.restore();
                // --- END OPTIMIZATION ---
            }
        }
        ctx.restore();
    }
    
    const animate = () => {
      // Get the latest state directly from the store on each frame
      const { 
        currentSettings, 
        textureRotation, 
        previousGradient, 
        transitionProgress 
      } = useTextureStore.getState();

      timeRef.current += currentSettings.animationSpeed;
      
      drawScene(
          timeRef.current, 
          currentSettings, 
          textureRotation, 
          previousGradient, 
          transitionProgress
      );

      animationFrameId.current = requestAnimationFrame(animate);
    };

    // Start the animation loop
    animationFrameId.current = requestAnimationFrame(animate);

    // Cleanup: cancel the animation frame when the component unmounts
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };
  }, []); // <-- Empty dependency array ensures this effect runs only once on mount

  return (
      <canvas ref={canvasRef} className={className} />
  );
};

export default TextureCanvas;