# Visual Patterns RT Tool - AI Agent Instructions

## Important Rules
- **NEVER commit changes automatically**: Always wait for explicit user request to commit
- Only run `git commit` commands when the user explicitly asks to commit changes
- You can prepare changes and show status, but do not execute commits without permission

## Project Overview
Real-time visual pattern generator for VJs and visual artists. React + Vite application with WebGL/Canvas2D renderers, MIDI integration for live performance, pattern sequencing, and state persistence.

## Architecture

### State Management (Zustand + Immer)
- **Single source of truth**: `store/` directory manages all app state via Zustand with Immer for immutable updates
- **Slice architecture**: State divided into specialized slices (project, settings, sequencer, midi, ui, animation)
- **Key state domains**: Project data, MIDI mappings, sequencer playback, pattern transitions, centralized animation system
- **Persistence**: Auto-saves to `localStorage` on every project mutation via `setProject()` action
- **State structure**: `Project → Sequences → Patterns → ControlSettings`
- **Animation system**: Centralized `activeAnimations` Map tracks all property interpolations with priority-based control

### Renderer Plugin System
Renderers are **completely independent modules** registered in `components/renderers/index.ts`:

```typescript
// Each renderer exports a RendererDefinition
export interface RendererDefinition {
  id: string;
  name: string;
  component: React.FC<{ className?: string }>;
  controlSchema: ControlSection[];  // Defines its own UI controls
}
```

**Key renderers**:
- `webgl/`: WebGL shader-based scale texture (primary renderer, 427 lines)
- `concentric/`: Canvas2D hexagonal concentric patterns
- `canvas2d/`: Legacy Canvas2D scale renderer

**Control Schema Pattern**: Each renderer defines its controls via `ControlSection[]` arrays (see `shared/scale-texture-schema.ts`). Controls can be:
- `type: 'slider'`: Declarative slider with min/max/formatter
- `type: 'custom'`: React component (e.g., `GradientEditor`, `BorderColorPicker`)

The `ControlPanel` dynamically renders controls using `<RendererControls />` which iterates over the active renderer's schema.

### MIDI Integration
- **Web MIDI API**: Direct browser MIDI support (check `navigator.requestMIDIAccess`)
- **MIDI Learn**: Two-click mapping flow - click control icon → move MIDI controller → auto-mapped
- **Pattern triggers**: Hold MIDI note for 0.5s to create pattern, tap to load pattern
- **Mappings stored per-project**: `project.globalSettings.midiMappings` maps `ControlSettings` keys to MIDI CC numbers
- **MIDI handling**: All logic in `store/slices/midi.slice.ts` (`connectMidi`, `_handleMidiMessage`, `startMidiLearning`)
- **Real-time CC mapping**: MIDI CC messages use `requestPropertyChange()` with highest priority (can cancel all other animations)
- **Note tracking**: `noteOnTime` object tracks note-on timestamps for hold detection
- **Priority**: MIDI has highest priority (ControlSource.MIDI = 3) - overrides UI, sequencer, and property automation

### Interaction Flows

#### Pattern Creation & Loading
1. **Manual save**: Click "Guardar Patrón Actual" → stores current `ControlSettings` as new pattern
2. **MIDI hold**: Hold note 0.5s → auto-creates pattern + assigns MIDI note
3. **MIDI tap**: Tap assigned note → `loadPattern()` with animated transition
4. **Sequencer trigger**: Step sequencer loads pattern on beat with full animation

#### Control Updates Priority
```
Priority Levels (ControlSource enum):
  MIDI (3)                → Highest priority, immediate changes (steps=0)
    ↓ (can cancel)
  UI (2)                  → User interactions, immediate or animated
    ↓ (can cancel)
  PropertySequencer (1)   → Keyframe automation, overlays patterns
    ↓ (can cancel)
  PatternSequencer (0)    → Lowest priority, pattern transitions

Flow: requestPropertyChange(property, from, to, steps, source, interpolationType)
  → Checks active animation priority
  → Cancels if new source >= existing source priority
  → Calculates frames from steps based on BPM
  → Adds to activeAnimations Map
  → RAF loop interpolates all active animations
```

### Pattern System
- **Patterns are snapshots**: Each pattern stores complete `ControlSettings` state
- **Animated transitions**: Pattern loading uses centralized `requestPropertyChange()` system
  - Duration controlled by `sequence.interpolationSpeed` (in steps: 0-8, supports fractions)
  - Steps converted to frames based on BPM: `totalFrames = steps * framesPerStep`
  - Gradient transitions use shader-based crossfade (`transitionProgress` uniform)
  - **Critical**: New animations cancel previous ones based on priority
- **Animate only changes**: Both sequencer and UI compare old vs new settings, only animate differences
- **Dirty state tracking**: User edits mark pattern as dirty, prompting save/overwrite
- **Priority system**: UI pattern loads (ControlSource.UI) have higher priority than sequencer loads (ControlSource.PatternSequencer)

### Real-Time Rendering Pipeline
```
User Input/MIDI → setCurrentSetting() → Zustand state update
                     ↓
                useTextureStore subscription triggers re-render
                     ↓
                Renderer component reads currentSettings
                     ↓
                WebGL: Upload uniforms → Fragment shader execution
                Canvas2D: Redraw loop with new parameters
                     ↓
                RequestAnimationFrame continues animation loop
```

**Performance notes**:
- Zustand uses `shallow` equality to prevent unnecessary re-renders
- WebGL shaders update uniforms each frame without DOM manipulation
- Gradient arrays converted to flat RGB arrays for shader uniform limits (max 10 colors)
- Texture rotation runs in independent RAF loop from `initializeProject()`

### Sequencer System
The app has **two independent sequencers** that run simultaneously:

#### 1. Pattern Sequencer (`components/sequencer/Sequencer.tsx`)
- **Grid UI**: 2D matrix where rows are patterns, columns are steps (8/12/16/24/32 configurable)
- **Step assignment**: Click cells to toggle pattern triggering at that step
- **Visual feedback**: Current step highlighted, active cells glow cyan
- **Playback**: On each tick, loads pattern assigned to current step (with animated transition)

#### 2. Property Sequencer (`components/sequencer/PropertySequencer.tsx`)
- **Per-property automation**: Add tracks for individual `ControlSettings` (e.g., `scaleSize`, `animationSpeed`)
- **Keyframe-based**: Click steps to add keyframes, drag to adjust values
- **Linear interpolation**: Values interpolated between keyframes automatically
- **Combined with patterns**: Property automation overlays on top of pattern settings
- **Track lanes**: Each property gets its own lane with visual keyframe indicators

#### Sequencer Timing & Execution (`store/slices/sequencer.slice.ts` → `_tickSequencer`)
```typescript
// 1. Advance step counter (wraps at numSteps)
// 2. Compare previous pattern with new pattern (if pattern changes)
// 3. Request animations ONLY for properties that differ (via requestPropertyChange with PatternSequencer priority)
// 4. Calculate property automation by interpolating between keyframes
// 5. Apply automation via requestPropertyChange with PropertySequencer priority
// 6. Calculate next tick using precise timestamp-based scheduling (compensates drift)
// 7. Schedule next tick: delay = idealNextTime - Date.now()
```

**Key implementation details**:
- BPM range: 30-240, controls tick interval
- Step counter loops at `numSteps` boundary
- Property automation uses **wrap-around interpolation** (keyframe at step 15 → keyframe at step 1)
- Automation values clamped to slider min/max from control schema
- **Pattern comparison**: Uses JSON.stringify for deep array comparison (gradients)
- **Timing precision**: Tracks `sequencerStartTime` and calculates ideal tick times to prevent drift
- **Priority system**: Pattern loads use ControlSource.PatternSequencer (lowest), automation uses PropertySequencer (higher)

## UI Architecture & Layout

### Main Layout (`App.tsx`)
- **Three-panel design**: Canvas (center), Control Panel (drawer), Sequencer (drawer)
- **Dual modes**: 
  - **Normal**: Desktop layout with fixed header, side panels
  - **Fullscreen**: Performance mode with auto-hide overlay (3s mouse idle timeout)
- **Header controls**: 
  - Logo + renderer selector dropdown
  - Viewport switcher (default/desktop/mobile preview)
  - MIDI console toggle
  - Fullscreen toggle
  - Settings/sequencer drawer toggles

### Control Panel Structure
Dynamically rendered from renderer's `controlSchema`:
- **Collapsible sections** (`CollapsibleSection` component)
- **Slider controls**: Auto-generated with MIDI learn button, value display, formatted label
- **Custom controls**: Embedded React components (e.g., `GradientEditor` for color management)
- **MIDI indicators**: Icons show cyan when mapped, orange when learning, white when available

### Gradient Editor (`components/controls/GradientEditor.tsx`)
- **Color stops management**: Add/remove/reorder colors with drag handles
- **Hard stop toggle**: Creates sharp boundaries (checkbox per color)
- **Color picker**: Browser-native color input
- **Min colors enforcement**: Prevents deletion below minimum (2 for gradients, 1 for backgrounds)

### Sequencer Panel
- **Transport controls**: Play/stop, BPM slider (30-240), step count selector
- **Pattern grid**: Scrollable horizontal grid, sticky pattern names column
- **Property tracks**: Expandable lanes with step buttons for keyframe placement
- **Visual playback**: Current step highlighted with gray background

## Development Workflows

### Running the app
```bash
npm run dev      # Starts Vite dev server on port 3000
npm run build    # Production build
npm run preview  # Preview production build
```

### Adding a New Renderer
1. Create folder in `components/renderers/yourname/`
2. Implement renderer component with `useTextureStore` subscription
3. Define `controlSchema: ControlSection[]` in `yourname/yourname-schema.ts`
4. Export `RendererDefinition` in `yourname/index.ts`
5. Register in `components/renderers/index.ts`

**Example schema**:
```typescript
export const yourSchema: ControlSection[] = [
  {
    title: "Section Title",
    defaultOpen: true,
    controls: [
      { type: 'slider', id: 'scaleSize', label: 'Size', min: 0, max: 100, step: 1, formatter: (v) => `${v}px` },
      { type: 'custom', id: 'customId', component: YourCustomComponent }
    ]
  }
];
```

### Adding New Control Settings
1. Add property to `ControlSettings` interface in `types.ts`
2. Add default value in `store/index.ts` initial `currentSettings`
3. Use via `setCurrentSetting(key, value)` - calls `requestPropertyChange()` with UI priority
4. For MIDI, users map via MIDI Learn (no code changes needed)

## Key Conventions

### Commit Messages (Conventional Commits)
Use semantic prefixes for automated changelog generation:
- **feat:** New features (e.g., `feat: add property sequencer`)
- **fix:** Bug fixes (e.g., `fix: resolve timing drift in sequencer`)
- **docs:** Documentation changes (e.g., `docs: update API examples`)
- **refactor:** Code refactoring without behavior change
- **perf:** Performance improvements
- **test:** Adding or updating tests
- **chore:** Tooling, dependencies, or maintenance tasks

**Format**: `<type>: <short description>`

Multi-line example:
```
fix: resolve sequencer glitch caused by race condition

- Add sequencerStartTime to track precise timing
- Skip settings updates during pattern animations
- Implement timestamp-based scheduling
```

### File Organization
- **Shared components**: `components/shared/` for cross-renderer UI (icons, CollapsibleSection)
- **Renderer-specific**: Keep renderer logic isolated in their folders
- **No JSX in .ts files**: Use `React.createElement()` for components in `.ts` schemas (see `scale-texture-schema.ts`)

### TypeScript Patterns
- **Discriminated unions**: `ControlConfig` uses `type` field to distinguish slider vs custom controls
- **Generic actions**: `setCurrentSetting<K extends keyof ControlSettings>` for type-safe updates
- **Immer**: All project mutations use `produce()` helper

### Animation Frame Management
- **Texture rotation**: Continuous `requestAnimationFrame` loop in `initializeProject()`
- **Property animations**: Centralized RAF loop in `animation.slice.ts` (_animationLoop)
- **Priority-based cancellation**: Higher priority sources can cancel lower priority animations
- **WebGL renderers**: Use `useEffect` cleanup to cancel RAF on unmount
- **Frame calculation**: Steps converted to frames based on BPM (framesPerStep = round(secondsPerStep * 60fps))

### Gradient Handling
- Gradients are `GradientColor[]` arrays with `{ id, color, hardStop }`
- **Shader transitions**: WebGL passes `u_prevGradientColors` + `u_transitionProgress` for crossfades
- **Hard stops**: `hardStop: true` creates sharp color boundaries (no interpolation)
- **Uniform limits**: WebGL shaders limited to 10 colors per gradient (hardcoded array size)
- **Color conversion**: Hex colors converted to RGB normalized floats (0.0-1.0) for shader uniforms
- **Gradient animation**: During pattern transitions, shaders blend between previous and new gradient arrays
  - `transitionProgress` uniform (0.0 → 1.0) controls crossfade
  - Background and scale gradients transition independently
  - Only transitions when gradient actually changed (checked in `loadPattern()`)

## Critical Gotchas

1. **Don't mutate store state directly**: Always use actions or `produce()`
2. **Use requestPropertyChange**: All property updates should go through the centralized animation system
3. **localStorage limits**: Project export/import to JSON files for safety
4. **MIDI note timing**: Pattern creation requires `noteOnTime` tracking (0.5s threshold)
5. **Renderer switching**: User can change `globalSettings.renderer` - components must handle missing settings gracefully
6. **Fullscreen mode**: Has separate UI state (`isOverlayVisible`, auto-hide on mouse idle)
7. **Sequencer timing**: Uses precise timestamp-based scheduling to avoid drift (tracks `sequencerStartTime`)
8. **Animation priority**: Respect ControlSource enum - MIDI(3) > UI(2) > PropertySequencer(1) > PatternSequencer(0)
9. **Steps to frames**: Frame calculation depends on BPM - fractional steps (0.25) supported for fine control

## External Dependencies
- **zustand** (5.0.8): State management
- **immer** (10.2.0): Immutable updates
- **Web MIDI API**: Browser-native, no library
- **Vite** (6.2.0): Build tool with React plugin

## Testing & Debugging

### Debug Overlay (`components/debug/DebugOverlay.tsx`)
Real-time telemetry and event logging for troubleshooting:
- **FPS counter**: Monitors RAF loop performance
- **Sequencer metrics**: Ticks count, current step, timing
- **Settings tracking**: Hash-based change detection
- **Animation state**: Shows active animations count (activeAnimations.size)
- **Event log**: Chronological record of sequencer ticks, pattern loads, animations
- **Export functionality**: Download debug data as JSON for analysis

### Console Debugging
Enable detailed logging from browser console:
```javascript
window.enableDebug()   // Enable sequencer logging
window.disableDebug()  // Disable logging
```

When enabled, logs include:
- `[SEQUENCER TICK]`: Step changes, pattern loading decisions
- `[PATTERN LOAD START]`: Pattern transition initialization
- `[PROPERTY AUTOMATION]`: Keyframe interpolation results
- `[SETTINGS UPDATED]`: Final computed settings after merge

### Debugging Workflow
1. Open Debug Overlay (purple bug button bottom-right)
2. Enable console logging: `window.enableDebug()`
3. Watch metrics in real-time while sequencer plays
4. Check event log for timing issues
5. Export debug data to compare states
6. Cross-reference console logs with overlay events

### Common Issues to Check
- **Glitches during playback**: Compare sequencer tick timing vs RAF calls (should be ~60 FPS)
- **Stuck transitions**: Check if active animations count stays non-zero
- **Settings not updating**: Compare `settingsHash` changes vs `settingsUpdates` counter
- **Property automation**: Verify interpolated values in console logs match expected ranges
- **Priority conflicts**: Check debug logs for animation cancellation events

### MidiConsole
- Use `MidiConsole` component to view MIDI messages in real-time
- MIDI log stored in `state.midiLog` (view via console icon)
- Check browser console for localStorage errors
- Fullscreen testing: Mouse movement triggers overlay visibility logic

## Project Files
- `default-project.json`: Default configuration loaded on first run
- `metadata.json`: Project metadata (version, description)
- No tests currently - manual testing workflows for MIDI + rendering
