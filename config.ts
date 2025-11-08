/**
 * Environment configuration
 * 
 * This file provides type-safe access to environment variables.
 * All environment variables must be prefixed with VITE_ to be exposed to the client.
 * 
 * @see https://vitejs.dev/guide/env-and-mode.html
 */

interface EnvConfig {
  /** Enable debug overlay and console logging */
  debugMode: boolean;
  /** Development mode flag */
  devMode: boolean;
  /** Gemini API key (if configured) */
  geminiApiKey?: string;
  /** Maximum FPS for rendering */
  maxFps: number;
  /** Auto-connect MIDI on startup */
  midiAutoConnect: boolean;
}

/**
 * Parse boolean from environment variable string
 */
const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
};

/**
 * Parse number from environment variable string
 */
const parseNumber = (value: string | undefined, defaultValue: number): number => {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Application environment configuration
 * Loads from environment variables with sensible defaults
 */
export const env: EnvConfig = {
  debugMode: parseBoolean(import.meta.env.VITE_DEBUG_MODE, false),
  devMode: parseBoolean(import.meta.env.VITE_DEV_MODE, import.meta.env.DEV),
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY,
  maxFps: parseNumber(import.meta.env.VITE_MAX_FPS, 60),
  midiAutoConnect: parseBoolean(import.meta.env.VITE_MIDI_AUTO_CONNECT, true),
};

/**
 * Check if running in development mode
 */
export const isDevelopment = (): boolean => {
  return import.meta.env.DEV;
};

/**
 * Check if running in production mode
 */
export const isProduction = (): boolean => {
  return import.meta.env.PROD;
};

/**
 * Get the current mode (development, production, etc.)
 */
export const getMode = (): string => {
  return import.meta.env.MODE;
};

/**
 * Log environment configuration (only in development)
 */
export const logEnvConfig = (): void => {
  if (isDevelopment()) {
    console.log('🔧 Environment Configuration:', {
      mode: getMode(),
      debugMode: env.debugMode,
      devMode: env.devMode,
      maxFps: env.maxFps,
      midiAutoConnect: env.midiAutoConnect,
      hasGeminiApiKey: !!env.geminiApiKey,
    });
  }
};
