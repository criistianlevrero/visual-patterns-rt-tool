# Environment Variables Guide

This document describes the environment variables used in the Visual Patterns RT Tool application.

## Setup

### Development

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` to customize your local configuration:
   ```bash
   nano .env
   # or
   vim .env
   # or open in your editor
   ```

3. Restart the dev server for changes to take effect:
   ```bash
   npm run dev
   ```

### Production

For production builds, environment variables should be set in your deployment platform or CI/CD pipeline.

**Important:** Never commit `.env` files with sensitive data to version control. The `.env` file is ignored by git.

## Available Variables

All environment variables must be prefixed with `VITE_` to be exposed to the client-side application.

### `VITE_DEBUG_MODE`

- **Type:** Boolean (`true` | `false`)
- **Default:** `false`
- **Description:** Enables the debug overlay and console logging features

When enabled:
- Shows the debug overlay (purple bug icon) in the bottom-right corner
- Exposes `window.enableDebug()` and `window.disableDebug()` functions
- Logs environment configuration on startup

**Development:**
```env
VITE_DEBUG_MODE=true
```

**Production:**
```env
VITE_DEBUG_MODE=false
```

### `VITE_DEV_MODE`

- **Type:** Boolean (`true` | `false`)
- **Default:** Auto-detected from Vite build mode
- **Description:** Development mode flag for additional development features

### `VITE_MAX_FPS`

- **Type:** Number
- **Default:** `60`
- **Description:** Maximum frames per second for rendering

Useful for performance testing or limiting rendering on lower-end devices:

```env
VITE_MAX_FPS=30
```

### `VITE_MIDI_AUTO_CONNECT`

- **Type:** Boolean (`true` | `false`)
- **Default:** `true`
- **Description:** Automatically connect to MIDI devices on startup

Set to `false` to require manual MIDI connection:

```env
VITE_MIDI_AUTO_CONNECT=false
```

### `VITE_GEMINI_API_KEY`

- **Type:** String
- **Default:** None
- **Description:** API key for Gemini integration (if needed)

**⚠️ Security Warning:** Never commit API keys to version control!

```env
VITE_GEMINI_API_KEY=your_api_key_here
```

## Usage in Code

### Import the configuration

```typescript
import { env, isDevelopment, isProduction, logEnvConfig } from './config';
```

### Access environment variables

```typescript
// Check if debug mode is enabled
if (env.debugMode) {
  console.log('Debug mode is active');
}

// Check development/production mode
if (isDevelopment()) {
  console.log('Running in development');
}

if (isProduction()) {
  console.log('Running in production');
}

// Log full configuration (only in development)
logEnvConfig();
```

### Type-safe access

The `env` object provides fully typed access to all environment variables:

```typescript
const maxFps: number = env.maxFps;
const debugMode: boolean = env.debugMode;
const apiKey: string | undefined = env.geminiApiKey;
```

## Adding New Variables

1. **Add to `.env.example`:**
   ```env
   VITE_NEW_VARIABLE=default_value
   ```

2. **Add TypeScript type in `vite-env.d.ts`:**
   ```typescript
   interface ImportMetaEnv {
     // ... existing variables
     readonly VITE_NEW_VARIABLE: string;
   }
   ```

3. **Add to config in `config.ts`:**
   ```typescript
   export const env: EnvConfig = {
     // ... existing properties
     newVariable: import.meta.env.VITE_NEW_VARIABLE,
   };
   ```

4. **Update this documentation** with the new variable details

## Best Practices

1. **Never commit sensitive data:** Always use `.env.example` with placeholder values
2. **Use defaults:** Provide sensible defaults in `config.ts` for all variables
3. **Document changes:** Update this guide when adding new variables
4. **Prefix with VITE_:** All client-side variables must start with `VITE_`
5. **Type safety:** Always use the `env` object from `config.ts` for type safety

## Troubleshooting

### Variables not updating

1. Restart the Vite dev server after changing `.env`:
   ```bash
   # Stop the server (Ctrl+C) then restart
   npm run dev
   ```

2. Clear the browser cache and hard reload (Ctrl+Shift+R)

### Variable is undefined

1. Check that the variable is prefixed with `VITE_`
2. Verify the variable is defined in `.env`
3. Restart the dev server
4. Check `vite-env.d.ts` has the type definition

### Debug mode not working

1. Check `.env` has `VITE_DEBUG_MODE=true`
2. Restart dev server
3. Check browser console for environment configuration log
4. Verify no errors in the console

## References

- [Vite Environment Variables Documentation](https://vitejs.dev/guide/env-and-mode.html)
- [TypeScript Environment Variables](https://vitejs.dev/guide/env-and-mode.html#intellisense-for-typescript)
