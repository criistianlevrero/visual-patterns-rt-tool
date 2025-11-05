
import React, { useEffect, useRef } from 'react';
import { useTextureStore } from '../store';
import type { ControlSettings, GradientColor } from '../types';

type RGBColor = { r: number, g: number, b: number };

interface TextureCanvasProps {
  className?: string;
}

const hexToRgb = (hex: string): RGBColor | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16) / 255.0,
        g: parseInt(result[2], 16) / 255.0,
        b: parseInt(result[3], 16) / 255.0
    } : null;
};

const vertexShaderSource = `
  attribute vec4 a_position;
  void main() {
    gl_Position = a_position;
  }
`;

const fragmentShaderSource = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_rotation;

  // ControlSettings uniforms
  uniform float u_scaleSize;
  uniform float u_scaleSpacing;
  uniform float u_verticalOverlap;
  uniform float u_horizontalOffset;
  uniform float u_shapeMorph;
  uniform float u_animationDirection;
  uniform float u_scaleBorderWidth;
  uniform vec3 u_scaleBorderColor;
  
  // Gradient uniforms
  uniform vec3 u_gradientColors[10];
  uniform bool u_hardStops[10];
  uniform int u_gradientColorCount;
  
  // Transition uniforms
  uniform vec3 u_prevGradientColors[10];
  uniform bool u_prevHardStops[10];
  uniform int u_prevGradientColorCount;
  uniform float u_transitionProgress;
  
  const float PI = 3.14159265359;
  const int MAX_GRADIENT_COLORS = 10;

  // --- 2D Rotation ---
  mat2 rotate2d(float angle) {
    return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  }
  
  // --- Signed Distance Functions (SDFs) for shapes ---
  float sdCircle(vec2 p, float r) {
    return length(p) - r;
  }

  // Replaced sdBox with sdDiamond for a rhombus shape.
  float sdDiamond(vec2 p, float r) {
    p = abs(p);
    // Manhattan distance, normalized to be comparable to Euclidean distance.
    return (p.x + p.y - r) * 0.70710678118;
  }
  
  float sdStar4(vec2 p, float r) {
    float r_in = r * 0.5; // The inner radius is half the outer radius.
    
    // Coordinates of the inner vertex in the first quadrant.
    // The angle is 45 degrees (PI/4).
    vec2 p_in_vtx = vec2(r_in * cos(PI/4.0), r_in * sin(PI/4.0));
    
    vec2 p_abs = abs(p);
    
    // Fold space into the first octant (where p_abs.x >= p_abs.y).
    if (p_abs.y > p_abs.x) {
        p_abs = p_abs.yx;
    }

    // The edge of the star in this octant goes from the outer vertex on the x-axis
    // to the inner vertex on the 45-degree line.
    vec2 p_out_vtx = vec2(r, 0.0);
    
    // Vector from our point to the inner vertex
    vec2 v = p_abs - p_in_vtx;
    
    // The edge vector
    vec2 e = p_out_vtx - p_in_vtx;
    
    // Project v onto e, and clamp the projection to the segment.
    // This finds the closest point on the line of the segment, but restricted to the segment.
    float t = clamp(dot(v, e) / dot(e, e), 0.0, 1.0);
    
    // Calculate the distance from our point to the closest point on the segment.
    float dist = length(v - e * t);
    
    // Determine if the point is inside or outside the star using the 2D cross product.
    // A negative sign means the point is "inside" the wedge defined by the origin and the edge.
    float sign_val = e.x * v.y - e.y * v.x;
    
    return dist * sign(sign_val);
  }

  // --- Color interpolation ---
  vec3 lerpColor(vec3 a, vec3 b, float t) {
      return a + (b - a) * t;
  }
  
  // --- Gradient Calculation ---
  vec3 calculateColorFromGradient(
    float animationValue, 
    vec3 colors[MAX_GRADIENT_COLORS], 
    bool hardStops[MAX_GRADIENT_COLORS], 
    int colorCount
  ) {
      if (colorCount < 1) return vec3(1.0);
      if (colorCount == 1) return colors[0];

      bool shouldLoop = !hardStops[0];
      float effectiveSegments = float(colorCount - 1);
      if (shouldLoop) {
          effectiveSegments = float(colorCount);
      }
      
      float normalizedValue = fract(animationValue / 360.0);
      if (normalizedValue < 0.0) {
          normalizedValue += 1.0;
      }
      
      float colorPosition = normalizedValue * effectiveSegments;
      float startIndex_f = floor(colorPosition);
      int startIndex = int(startIndex_f);
      float amount = colorPosition - startIndex_f;

      vec3 startColor = colors[0];
      vec3 endColor = colors[0];
      bool useHardStop = false;

      // GLSL ES 1.00 (WebGL 1) doesn't support dynamic indexing of arrays.
      // We must use a loop with a constant iterator and conditional statements
      // to select the correct values from the arrays.
      for (int i = 0; i < MAX_GRADIENT_COLORS; ++i) {
          if (i >= colorCount) {
              break;
          }

          if (i == startIndex) {
              startColor = colors[i];
          }
          
          int endIndex = startIndex + 1;
          if (shouldLoop) {
              endIndex = int(mod(float(startIndex + 1), float(colorCount)));
          } else {
              endIndex = int(min(float(startIndex + 1), float(colorCount - 1)));
          }

          if (i == endIndex) {
              endColor = colors[i];
              if (i > 0) { // hard stop at index 0 is for looping control
                  useHardStop = hardStops[i];
              }
          }
      }
      
      if (useHardStop) {
          return startColor;
      }

      return lerpColor(startColor, endColor, amount);
  }

  // --- Helper Functions ---
  float is_odd(float val) {
    // A robust way to check if a float representing an integer is odd.
    // It correctly handles negative numbers, which 'mod' can be unreliable for.
    return abs(val - floor(val / 2.0) * 2.0) >= 0.5 ? 1.0 : 0.0;
  }
  
  void main() {
    vec2 st = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
    st = rotate2d(u_rotation * PI / 180.0) * st;

    float radius = u_scaleSize / min(u_resolution.x, u_resolution.y);
    float horizontalStep = radius + (u_scaleSize * u_scaleSpacing / min(u_resolution.x, u_resolution.y));
    float verticalStep = radius + (u_scaleSize * u_verticalOverlap / min(u_resolution.x, u_resolution.y));

    if (horizontalStep <= 0.0 || verticalStep <= 0.0) {
      gl_FragColor = vec4(0.121, 0.160, 0.215, 1.0); // bg-gray-800
      return;
    }
    
    // --- Grid Calculation (Robust Painter's Algorithm) ---
    // This method simulates drawing scales by finding the "top-most" scale
    // for any given pixel. The winner is chosen using a lexicographical comparison:
    // 1. Is the pixel inside the shape? (inside > outside)
    // 2. Y-position of the shape's grid cell (higher > lower)
    // 3. X-position of the shape's grid cell (right > left)
    
    vec2 simpleGridId = floor(st / vec2(horizontalStep, verticalStep));

    float winnerShapeDist = 1000.0;
    vec2 winnerGridId = vec2(0.0);
    vec3 winnerScore = vec3(-1.0, -1.0e9, -1.0e9); // (is_inside, depth_y, depth_x)

    // Check a 5x5 area to handle extreme overlaps.
    for (int j = -2; j <= 2; j++) {
        for (int i = -2; i <= 2; i++) {
            vec2 offset = vec2(float(i), float(j));
            vec2 currentGridId = simpleGridId + offset;
            
            float staggerOffset = is_odd(currentGridId.y) * horizontalStep * u_horizontalOffset;
            vec2 cellCenter = vec2(
                (currentGridId.x + 0.5) * horizontalStep + staggerOffset,
                (currentGridId.y + 0.5) * verticalStep
            );
            
            vec2 p = st - cellCenter;

            // Calculate SDF for the shape in this cell
            float circle = sdCircle(p, radius);
            float diamond = sdDiamond(p, radius);
            float star = sdStar4(p, radius);
    
            float currentShapeDist;
            if (u_shapeMorph <= 0.5) {
                currentShapeDist = mix(circle, diamond, u_shapeMorph * 2.0);
            } else {
                currentShapeDist = mix(diamond, star, (u_shapeMorph - 0.5) * 2.0);
            }
            
            float is_inside = currentShapeDist <= 0.0 ? 1.0 : 0.0; // 1.0 if inside, 0.0 if outside
            vec3 currentScore = vec3(is_inside, currentGridId.y, currentGridId.x);

            // Lexicographical comparison to find the winner
            if (currentScore.x > winnerScore.x ||
               (currentScore.x == winnerScore.x && currentScore.y > winnerScore.y) ||
               (currentScore.x == winnerScore.x && currentScore.y == winnerScore.y && currentScore.z > winnerScore.z))
            {
                winnerScore = currentScore;
                winnerShapeDist = currentShapeDist;
                winnerGridId = currentGridId;
            }
        }
    }

    float shapeDist = winnerShapeDist;
    vec2 finalGridId = winnerGridId;

    // --- Color Calculation ---
    float angleInRadians = u_animationDirection * (PI / 180.0);
    vec2 dir = vec2(cos(angleInRadians), sin(angleInRadians));
    float colorSpread = 15.0;
    
    // Use the gridId of the closest shape for consistent color patterns.
    float hueOffset = (finalGridId.x * dir.x + finalGridId.y * dir.y) * colorSpread;
    float animationValue = u_time + hueOffset;

    vec3 mainColor = calculateColorFromGradient(animationValue, u_gradientColors, u_hardStops, u_gradientColorCount);

    if (u_transitionProgress < 1.0) {
        vec3 prevColor = calculateColorFromGradient(animationValue, u_prevGradientColors, u_prevHardStops, u_prevGradientColorCount);
        mainColor = lerpColor(prevColor, mainColor, u_transitionProgress);
    }

    // --- Final Color Composition ---
    vec3 backgroundColor = vec3(0.121, 0.160, 0.215); // bg-gray-800
    float edgeSoftness = 1.0 / min(u_resolution.x, u_resolution.y);
    
    vec3 finalColor;

    // When the border width is effectively zero, the anti-aliasing ('smoothstep')
    // can create faint, semi-transparent seams between adjacent scales by blending
    // their edges with the background. To guarantee no seams, we switch to a
    // hard-edged 'step' function. This creates a fully opaque fill, eliminating
    // the seams at the cost of introducing aliasing (jagged edges).
    // FIX: Replaced 'step(shapeDist, 0.0)' with a ternary operator to avoid potential driver bugs with the 'step' function.
    if (u_scaleBorderWidth < 0.01) {
        float fillAlpha = shapeDist <= 0.0 ? 1.0 : 0.0;
        finalColor = mix(backgroundColor, mainColor, fillAlpha);
    } 
    // Otherwise, use a robust 3-layer composition (background, border, fill)
    // with anti-aliasing.
    else {
        float borderWidth_norm = u_scaleBorderWidth / min(u_resolution.x, u_resolution.y);
        
        // Alpha for the border (the full shape's outer edge)
        // FIX: The GLSL spec has undefined behavior for smoothstep when edge0 >= edge1. Swapped arguments and subtracted from 1.0 to get the desired inverted effect.
        float borderAlpha = 1.0 - smoothstep(-edgeSoftness, edgeSoftness, shapeDist);
        // Alpha for the fill (an inset shape)
        float fillAlpha = 1.0 - smoothstep(-edgeSoftness, edgeSoftness, shapeDist + borderWidth_norm);

        // Layer 1: Mix border color onto the background
        finalColor = mix(backgroundColor, u_scaleBorderColor, borderAlpha);
        // Layer 2: Mix fill color over the result
        finalColor = mix(finalColor, mainColor, fillAlpha);
    }
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

const TextureCanvas: React.FC<TextureCanvasProps> = ({ className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const timeRef = useRef<number>(0);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const uniformLocationsRef = useRef<Record<string, WebGLUniformLocation | null>>({});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { antialias: true });
    if (!gl) {
      console.error("WebGL not supported");
      return;
    }
    glRef.current = gl;

    // --- Shader and Program Setup ---
    const createShader = (type: number, source: string): WebGLShader | null => {
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    };

    const createProgram = (vs: WebGLShader, fs: WebGLShader): WebGLProgram | null => {
        const program = gl.createProgram();
        if (!program) return null;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    };

    const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) return;

    const program = createProgram(vertexShader, fragmentShader);
    if (!program) return;
    programRef.current = program;
    gl.useProgram(program);

    // --- Buffer for a fullscreen quad ---
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [-1, 1, 1, 1, -1, -1, 1, -1];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    // --- Get Uniform Locations ---
    const ulocs: Record<string, WebGLUniformLocation | null> = {
      resolution: gl.getUniformLocation(program, "u_resolution"),
      time: gl.getUniformLocation(program, "u_time"),
      rotation: gl.getUniformLocation(program, "u_rotation"),
      scaleSize: gl.getUniformLocation(program, "u_scaleSize"),
      scaleSpacing: gl.getUniformLocation(program, "u_scaleSpacing"),
      verticalOverlap: gl.getUniformLocation(program, "u_verticalOverlap"),
      horizontalOffset: gl.getUniformLocation(program, "u_horizontalOffset"),
      shapeMorph: gl.getUniformLocation(program, "u_shapeMorph"),
      animationDirection: gl.getUniformLocation(program, "u_animationDirection"),
      scaleBorderWidth: gl.getUniformLocation(program, "u_scaleBorderWidth"),
      scaleBorderColor: gl.getUniformLocation(program, "u_scaleBorderColor"),
      gradientColorCount: gl.getUniformLocation(program, "u_gradientColorCount"),
      prevGradientColorCount: gl.getUniformLocation(program, "u_prevGradientColorCount"),
      transitionProgress: gl.getUniformLocation(program, "u_transitionProgress"),
    };
    for (let i = 0; i < 10; i++) {
        ulocs[`gradientColors[${i}]`] = gl.getUniformLocation(program, `u_gradientColors[${i}]`);
        ulocs[`hardStops[${i}]`] = gl.getUniformLocation(program, `u_hardStops[${i}]`);
        ulocs[`prevGradientColors[${i}]`] = gl.getUniformLocation(program, `u_prevGradientColors[${i}]`);
        ulocs[`prevHardStops[${i}]`] = gl.getUniformLocation(program, `u_prevHardStops[${i}]`);
    }
    uniformLocationsRef.current = ulocs;


    // --- Animation Loop ---
    const animate = () => {
      const gl = glRef.current;
      const program = programRef.current;
      const ulocs = uniformLocationsRef.current;

      if (!gl || !program || !ulocs) {
        animationFrameId.current = requestAnimationFrame(animate);
        return;
      }
      
      const { 
        currentSettings, 
        textureRotation, 
        previousGradient, 
        transitionProgress 
      } = useTextureStore.getState();

      timeRef.current += currentSettings.animationSpeed;

      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.clearColor(0.121, 0.160, 0.215, 1.0); // bg-gray-800
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);

      // --- Update Uniforms ---
      gl.uniform2f(ulocs.resolution, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(ulocs.time, timeRef.current);
      gl.uniform1f(ulocs.rotation, textureRotation);
      
      // ControlSettings uniforms
      gl.uniform1f(ulocs.scaleSize, currentSettings.scaleSize);
      gl.uniform1f(ulocs.scaleSpacing, currentSettings.scaleSpacing);
      gl.uniform1f(ulocs.verticalOverlap, currentSettings.verticalOverlap);
      gl.uniform1f(ulocs.horizontalOffset, currentSettings.horizontalOffset);
      gl.uniform1f(ulocs.shapeMorph, currentSettings.shapeMorph);
      gl.uniform1f(ulocs.animationDirection, currentSettings.animationDirection);
      gl.uniform1f(ulocs.scaleBorderWidth, currentSettings.scaleBorderWidth);
      const borderColorRgb = hexToRgb(currentSettings.scaleBorderColor);
      if (borderColorRgb) {
          gl.uniform3f(ulocs.scaleBorderColor, borderColorRgb.r, borderColorRgb.g, borderColorRgb.b);
      }
      
      // Gradient uniforms
      const colors = currentSettings.gradientColors.slice(0, 10);
      gl.uniform1i(ulocs.gradientColorCount, colors.length);
      colors.forEach((c, i) => {
          const rgb = hexToRgb(c.color);
          if (rgb) {
              gl.uniform3f(ulocs[`gradientColors[${i}]`], rgb.r, rgb.g, rgb.b);
          }
          gl.uniform1i(ulocs[`hardStops[${i}]`], c.hardStop ? 1 : 0);
      });

      // Transition uniforms
      gl.uniform1f(ulocs.transitionProgress, transitionProgress);
      if (previousGradient && transitionProgress < 1.0) {
          const prevColors = previousGradient.slice(0, 10);
          gl.uniform1i(ulocs.prevGradientColorCount, prevColors.length);
          prevColors.forEach((c, i) => {
              const rgb = hexToRgb(c.color);
              if (rgb) {
                  gl.uniform3f(ulocs[`prevGradientColors[${i}]`], rgb.r, rgb.g, rgb.b);
              }
              gl.uniform1i(ulocs[`prevHardStops[${i}]`], c.hardStop ? 1 : 0);
          });
      } else {
         gl.uniform1i(ulocs.prevGradientColorCount, 0);
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      animationFrameId.current = requestAnimationFrame(animate);
    };

    // --- Resize Handling ---
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const dpr = window.devicePixelRatio || 1;
        
        if (width > 0 && height > 0) {
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
        }
      }
    });
    resizeObserver.observe(canvas);
    
    // --- Start and Cleanup ---
    animationFrameId.current = requestAnimationFrame(animate);

    return () => {
      resizeObserver.disconnect();
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      // TODO: Clean up WebGL resources if component unmounts
    };
  }, []); 

  return <canvas ref={canvasRef} className={className} />;
};

export default TextureCanvas;
