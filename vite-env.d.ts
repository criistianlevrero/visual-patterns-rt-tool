/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Enable debug overlay and console logging */
  readonly VITE_DEBUG_MODE: string;
  /** Development mode flag */
  readonly VITE_DEV_MODE: string;
  /** Gemini API key */
  readonly VITE_GEMINI_API_KEY: string;
  /** Maximum FPS for rendering */
  readonly VITE_MAX_FPS: string;
  /** Auto-connect MIDI on startup */
  readonly VITE_MIDI_AUTO_CONNECT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
