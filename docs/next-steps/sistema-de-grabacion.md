# Sistema de Grabación de Performances

## Descripción General

Sistema para grabar, reproducir y exportar performances visuales como video. Permite capturar todos los cambios de estado en tiempo real (MIDI, sequencer, animaciones) y reproducirlos posteriormente con opciones de renderizado en diferentes resoluciones.

## Funcionalidades Principales

### 1. Grabación de Performance
- **Captura de datos de estado**: Registrar todos los cambios en `ControlSettings` con timestamps precisos
- **Fuentes de datos a grabar**:
  - Cambios MIDI (CC messages, note on/off)
  - Transiciones de patrones (sequencer y manuales)
  - Animaciones de propiedades (property sequencer)
  - Cambios manuales de controles (UI)
  - Cambios de renderer
  - Estado del sequencer (play/pause, BPM, step actual)

### 2. Reproducción
- **Playback temporal**: Reproducir la grabación con timing exacto
- **Controles de reproducción**: Play, pause, stop, seek (barra de progreso)
- **Visualización en tiempo real**: Vista previa del canvas durante reproducción
- **Velocidad ajustable**: Reproducir a velocidad normal, 0.5x, 2x, etc.

### 3. Gestión de Archivos
- **Guardar grabación**: Exportar datos a archivo JSON
- **Cargar grabación**: Importar grabación desde archivo
- **Formato de archivo**: JSON con metadata + array de eventos temporales

### 4. Renderizado a Video
- **Selector de resolución**: Resoluciones comunes (720p, 1080p, 1440p, 4K)
- **Resolución personalizada**: Input manual de ancho x alto
- **Formatos de salida**: WebM (VP9), MP4 (H.264 si disponible)
- **Opciones de calidad**: Bitrate configurable
- **Barra de progreso**: Indicador visual del progreso de renderizado

## Arquitectura Técnica

### Estructura de Datos

#### Formato de Grabación
```typescript
interface Recording {
  metadata: RecordingMetadata;
  events: RecordingEvent[];
  initialState: ControlSettings;
  projectSnapshot: Project; // Estado completo del proyecto al inicio
}

interface RecordingMetadata {
  version: string;
  timestamp: number; // Unix timestamp de inicio
  duration: number; // Duración total en ms
  renderer: string; // ID del renderer usado
  fps: number; // FPS de grabación (default: 60)
  resolution: { width: number; height: number };
}

interface RecordingEvent {
  timestamp: number; // Tiempo relativo al inicio (ms)
  type: 'setting' | 'sequencer' | 'midi' | 'renderer';
  data: RecordingEventData;
}

type RecordingEventData =
  | { type: 'setting'; key: keyof ControlSettings; value: any; source: ControlSource }
  | { type: 'sequencer'; action: 'play' | 'pause' | 'stop'; step?: number; bpm?: number }
  | { type: 'midi'; message: MidiMessageEvent }
  | { type: 'renderer'; rendererId: string };
```

### Implementación Propuesta

#### 1. Nuevo Slice de Zustand: `recording.slice.ts`

```typescript
interface RecordingSlice {
  // Estado de grabación
  isRecording: boolean;
  isPaused: boolean;
  currentRecording: Recording | null;
  recordingStartTime: number | null;
  
  // Estado de reproducción
  isPlaying: boolean;
  currentPlaybackTime: number;
  loadedRecording: Recording | null;
  
  // Estado de renderizado
  isRendering: boolean;
  renderProgress: number; // 0-100
  
  // Acciones de grabación
  startRecording: () => void;
  pauseRecording: () => void;
  stopRecording: () => Recording;
  recordEvent: (event: RecordingEvent) => void;
  
  // Acciones de reproducción
  loadRecording: (recording: Recording) => void;
  playRecording: () => void;
  pausePlayback: () => void;
  stopPlayback: () => void;
  seekTo: (timeMs: number) => void;
  
  // Acciones de archivo
  exportRecording: (filename: string) => void;
  importRecording: (file: File) => Promise<void>;
  
  // Acciones de renderizado
  renderToVideo: (options: RenderOptions) => Promise<Blob>;
}

interface RenderOptions {
  width: number;
  height: number;
  fps: number;
  format: 'webm' | 'mp4';
  bitrate?: number;
  onProgress?: (progress: number) => void;
}
```

#### 2. Motor de Grabación

**Interceptar cambios de estado**:
```typescript
// En cada slice que modifique ControlSettings
setCurrentSetting: <K extends keyof ControlSettings>(
  key: K,
  value: ControlSettings[K],
  source: ControlSource = ControlSource.UI
) => {
  set(produce((state) => {
    state.currentSettings[key] = value;
    
    // Si estamos grabando, registrar evento
    if (state.isRecording) {
      state.recordEvent({
        timestamp: Date.now() - state.recordingStartTime!,
        type: 'setting',
        data: { type: 'setting', key, value, source }
      });
    }
  }));
}
```

**Listener global para eventos**:
```typescript
// Hook o middleware que escucha todos los cambios relevantes
const useRecordingListener = () => {
  const recordEvent = useTextureStore(state => state.recordEvent);
  const isRecording = useTextureStore(state => state.isRecording);
  
  useEffect(() => {
    if (!isRecording) return;
    
    // Suscribirse a cambios de store
    const unsubscribe = useTextureStore.subscribe(
      (state) => state.currentSettings,
      (settings, prevSettings) => {
        // Detectar diferencias y grabar
        const changes = detectChanges(prevSettings, settings);
        changes.forEach(change => recordEvent(change));
      }
    );
    
    return unsubscribe;
  }, [isRecording]);
};
```

#### 3. Motor de Reproducción

```typescript
const playRecording = () => {
  set({ isPlaying: true });
  const startTime = Date.now();
  const recording = get().loadedRecording;
  
  if (!recording) return;
  
  // Restaurar estado inicial
  set({ currentSettings: recording.initialState });
  
  // Programar eventos con setTimeout
  recording.events.forEach(event => {
    setTimeout(() => {
      applyRecordingEvent(event);
    }, event.timestamp);
  });
  
  // Timer para actualizar currentPlaybackTime
  const intervalId = setInterval(() => {
    const elapsed = Date.now() - startTime;
    set({ currentPlaybackTime: elapsed });
    
    if (elapsed >= recording.metadata.duration) {
      clearInterval(intervalId);
      set({ isPlaying: false });
    }
  }, 16); // ~60 FPS
};

const applyRecordingEvent = (event: RecordingEvent) => {
  switch (event.data.type) {
    case 'setting':
      get().setCurrentSetting(event.data.key, event.data.value, event.data.source);
      break;
    case 'sequencer':
      // Aplicar acción de sequencer
      break;
    case 'midi':
      // Simular mensaje MIDI
      break;
    case 'renderer':
      // Cambiar renderer
      break;
  }
};
```

#### 4. Sistema de Renderizado a Video

**Usar MediaRecorder API + Canvas Capture**:

```typescript
const renderToVideo = async (options: RenderOptions): Promise<Blob> => {
  const recording = get().loadedRecording;
  if (!recording) throw new Error('No recording loaded');
  
  // 1. Crear canvas offscreen con resolución deseada
  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = options.width;
  offscreenCanvas.height = options.height;
  
  // 2. Obtener contexto del renderer actual
  // (requiere modificar renderers para aceptar canvas custom)
  const renderer = createOffscreenRenderer(offscreenCanvas);
  
  // 3. Configurar MediaRecorder
  const stream = offscreenCanvas.captureStream(options.fps);
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: `video/${options.format}`,
    videoBitsPerSecond: options.bitrate || 5000000 // 5 Mbps default
  });
  
  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
  
  // 4. Iniciar grabación
  mediaRecorder.start();
  set({ isRendering: true, renderProgress: 0 });
  
  // 5. Reproducir frame por frame
  const frameDuration = 1000 / options.fps;
  const totalFrames = Math.ceil(recording.metadata.duration / frameDuration);
  
  for (let frame = 0; frame < totalFrames; frame++) {
    const currentTime = frame * frameDuration;
    
    // Aplicar todos los eventos hasta este tiempo
    const eventsToApply = recording.events.filter(
      e => e.timestamp <= currentTime && e.timestamp > (currentTime - frameDuration)
    );
    eventsToApply.forEach(applyRecordingEvent);
    
    // Renderizar frame
    await renderer.render(get().currentSettings);
    
    // Actualizar progreso
    const progress = (frame / totalFrames) * 100;
    set({ renderProgress: progress });
    options.onProgress?.(progress);
    
    // Esperar tiempo de frame
    await new Promise(resolve => setTimeout(resolve, frameDuration));
  }
  
  // 6. Finalizar grabación
  mediaRecorder.stop();
  
  return new Promise((resolve) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: `video/${options.format}` });
      set({ isRendering: false, renderProgress: 0 });
      resolve(blob);
    };
  });
};
```

**Alternativa para mejor control (usando FFMPEG.wasm)**:
```typescript
// Para mayor control sobre encoding y evitar limitaciones del navegador
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

const renderToVideoFFmpeg = async (options: RenderOptions): Promise<Blob> => {
  const ffmpeg = createFFmpeg({ log: true });
  await ffmpeg.load();
  
  // 1. Renderizar todos los frames como imágenes PNG
  const frames: Blob[] = [];
  const frameDuration = 1000 / options.fps;
  const totalFrames = Math.ceil(recording.metadata.duration / frameDuration);
  
  for (let frame = 0; frame < totalFrames; frame++) {
    // Aplicar eventos y renderizar
    // ...
    const imageBlob = await offscreenCanvas.toBlob();
    frames.push(imageBlob);
  }
  
  // 2. Escribir frames al sistema de archivos virtual de FFMPEG
  for (let i = 0; i < frames.length; i++) {
    const paddedNumber = String(i).padStart(6, '0');
    ffmpeg.FS('writeFile', `frame${paddedNumber}.png`, await fetchFile(frames[i]));
  }
  
  // 3. Ejecutar encoding
  await ffmpeg.run(
    '-framerate', String(options.fps),
    '-i', 'frame%06d.png',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-b:v', `${options.bitrate || 5000000}`,
    'output.mp4'
  );
  
  // 4. Leer resultado
  const data = ffmpeg.FS('readFile', 'output.mp4');
  return new Blob([data.buffer], { type: 'video/mp4' });
};
```

#### 5. Componente UI: `RecordingPanel.tsx`

```typescript
export const RecordingPanel: React.FC = () => {
  const {
    isRecording,
    isPlaying,
    isRendering,
    renderProgress,
    currentRecording,
    loadedRecording,
    startRecording,
    stopRecording,
    playRecording,
    stopPlayback,
    exportRecording,
    importRecording,
    renderToVideo
  } = useTextureStore();
  
  const [renderResolution, setRenderResolution] = useState({ width: 1920, height: 1080 });
  const [renderFormat, setRenderFormat] = useState<'webm' | 'mp4'>('webm');
  
  const handleRender = async () => {
    const videoBlob = await renderToVideo({
      ...renderResolution,
      fps: 60,
      format: renderFormat,
      onProgress: (progress) => console.log(`Rendering: ${progress}%`)
    });
    
    // Descargar automáticamente
    const url = URL.createObjectURL(videoBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-${Date.now()}.${renderFormat}`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="recording-panel">
      {/* Sección de grabación */}
      <CollapsibleSection title="Grabación" defaultOpen>
        <div className="recording-controls">
          {!isRecording ? (
            <Button onClick={startRecording}>🔴 Iniciar Grabación</Button>
          ) : (
            <Button onClick={stopRecording}>⏹️ Detener Grabación</Button>
          )}
          
          {currentRecording && (
            <Button onClick={() => exportRecording('my-performance.json')}>
              💾 Guardar Grabación
            </Button>
          )}
        </div>
      </CollapsibleSection>
      
      {/* Sección de reproducción */}
      <CollapsibleSection title="Reproducción">
        <input
          type="file"
          accept=".json"
          onChange={(e) => e.target.files?.[0] && importRecording(e.target.files[0])}
        />
        
        {loadedRecording && (
          <>
            <div className="playback-controls">
              {!isPlaying ? (
                <Button onClick={playRecording}>▶️ Reproducir</Button>
              ) : (
                <Button onClick={stopPlayback}>⏸️ Pausar</Button>
              )}
            </div>
            
            {/* Barra de progreso */}
            <progress
              value={currentPlaybackTime}
              max={loadedRecording.metadata.duration}
            />
          </>
        )}
      </CollapsibleSection>
      
      {/* Sección de renderizado */}
      <CollapsibleSection title="Exportar Video">
        <div className="render-controls">
          {/* Selector de resolución */}
          <select
            value={`${renderResolution.width}x${renderResolution.height}`}
            onChange={(e) => {
              const [width, height] = e.target.value.split('x').map(Number);
              setRenderResolution({ width, height });
            }}
          >
            <option value="1280x720">HD 720p (1280x720)</option>
            <option value="1920x1080">Full HD 1080p (1920x1080)</option>
            <option value="2560x1440">2K 1440p (2560x1440)</option>
            <option value="3840x2160">4K 2160p (3840x2160)</option>
            <option value="custom">Personalizada...</option>
          </select>
          
          {/* Formato */}
          <select value={renderFormat} onChange={(e) => setRenderFormat(e.target.value as any)}>
            <option value="webm">WebM (VP9)</option>
            <option value="mp4">MP4 (H.264)</option>
          </select>
          
          {/* Botón de render */}
          <Button
            onClick={handleRender}
            disabled={!loadedRecording || isRendering}
          >
            {isRendering ? `Renderizando... ${renderProgress}%` : '🎬 Renderizar Video'}
          </Button>
          
          {isRendering && <progress value={renderProgress} max={100} />}
        </div>
      </CollapsibleSection>
    </div>
  );
};
```

### Modificaciones Necesarias en el Proyecto

#### 1. Actualizar Renderers
Los renderers deben poder trabajar con canvas offscreen para renderizado:

```typescript
// Modificar interface RendererDefinition
export interface RendererDefinition {
  id: string;
  name: string;
  component: React.FC<{ className?: string }>;
  controlSchema: ControlSection[];
  createOffscreenRenderer?: (canvas: HTMLCanvasElement) => OffscreenRendererInstance;
}

export interface OffscreenRendererInstance {
  render: (settings: ControlSettings) => Promise<void>;
  dispose: () => void;
}
```

#### 2. Integración con Sistema de Animación
El sistema de grabación debe registrar todos los cambios que vienen de `requestPropertyChange()`:

```typescript
// En animation.slice.ts
export const requestPropertyChange = (
  property: keyof ControlSettings,
  from: any,
  to: any,
  steps: number,
  source: ControlSource,
  interpolationType?: InterpolationType
) => {
  // ... código existente ...
  
  // Registrar en grabación
  if (get().isRecording) {
    get().recordEvent({
      timestamp: Date.now() - get().recordingStartTime!,
      type: 'setting',
      data: {
        type: 'setting',
        key: property,
        value: to,
        source,
        steps,
        interpolationType
      }
    });
  }
};
```

#### 3. Persistencia y Límites
- **Tamaño máximo de grabación**: Limitar duración o tamaño de archivo (ej: 30 min máx)
- **Compresión**: Para grabaciones largas, considerar comprimir eventos repetitivos
- **Streaming de datos**: Para grabaciones muy largas, escribir a disco en chunks

### Consideraciones de Performance

1. **Grabación en tiempo real**:
   - Usar `requestAnimationFrame` para sincronizar timestamps
   - Buffer circular para eventos recientes (evitar memory leaks)
   - Throttling de eventos de alta frecuencia (ej: MIDI CC)

2. **Reproducción**:
   - Pre-cargar eventos en memoria
   - Usar Web Workers para procesamiento de eventos
   - Implementar sistema de buffering para eventos próximos

3. **Renderizado**:
   - Usar OffscreenCanvas cuando sea posible
   - Renderizar en chunks (ej: 10 segundos a la vez)
   - Mostrar preview en tiempo real durante renderizado
   - Permitir cancelar renderizado en progreso

### Formatos de Archivo Alternativos

Además de JSON, considerar:
- **Binary format**: Usar MessagePack o Protobuf para reducir tamaño
- **Compresión**: Gzip/Brotli para archivos JSON grandes
- **Streaming format**: Para grabaciones muy largas, formato que permita lectura incremental

### Roadmap de Implementación

**Fase 1: Grabación básica**
- [ ] Crear `recording.slice.ts`
- [ ] Implementar `startRecording()`, `stopRecording()`, `recordEvent()`
- [ ] Integrar con `setCurrentSetting()` y `requestPropertyChange()`
- [ ] Crear formato JSON de grabación

**Fase 2: Reproducción**
- [ ] Implementar `playRecording()`, `pausePlayback()`, `seekTo()`
- [ ] Sistema de aplicación de eventos temporales
- [ ] UI de reproducción con controles

**Fase 3: Gestión de archivos**
- [ ] Exportar/importar JSON
- [ ] Validación de formato de archivo
- [ ] UI para cargar/guardar grabaciones

**Fase 4: Renderizado a video**
- [ ] Modificar renderers para soportar offscreen canvas
- [ ] Implementar `renderToVideo()` con MediaRecorder API
- [ ] UI de configuración de renderizado
- [ ] Barra de progreso y estimación de tiempo

**Fase 5: Optimizaciones**
- [ ] Compresión de eventos
- [ ] Web Workers para procesamiento
- [ ] Caché de frames durante reproducción
- [ ] Soporte para FFMPEG.wasm (encoding avanzado)

### Dependencias Adicionales

```json
{
  "dependencies": {
    "@ffmpeg/ffmpeg": "^0.12.0",  // Opcional: para encoding avanzado
    "@ffmpeg/core": "^0.12.0"
  }
}
```

### Testing

- **Unit tests**: Probar serialización/deserialización de eventos
- **Integration tests**: Grabar → reproducir → verificar estado final
- **Performance tests**: Medir overhead de grabación en tiempo real
- **Compatibility tests**: Verificar soporte de MediaRecorder en diferentes navegadores

### Referencias

- **MediaRecorder API**: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- **Canvas.captureStream()**: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream
- **FFMPEG.wasm**: https://ffmpegwasm.netlify.app/
- **Web Workers**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API

---

## Notas Adicionales

### Compatibilidad de Navegadores
- **MediaRecorder**: Soportado en Chrome, Firefox, Edge (verificar Safari)
- **OffscreenCanvas**: Soporte limitado en Safari < 16.4
- **Codec VP9**: Mejor soporte en Chrome/Firefox, limitado en Safari
- **Codec H.264**: Soporte universal pero puede requerir configuración

### Alternativas de Implementación
- **Server-side rendering**: Usar Node.js + headless browser para renderizado en servidor
- **GPU acceleration**: WebGL para procesar frames más rápido
- **Progressive rendering**: Generar video en chunks y permitir descarga incremental

### Mejoras Futuras
- **Edición no destructiva**: Permitir editar grabaciones (cortar, empalmar)
- **Múltiples takes**: Grabar varias versiones y seleccionar la mejor
- **Overdubbing**: Grabar nuevos controles sobre grabación existente
- **Timeline visual**: Editor visual de eventos con tracks
- **Exportar audio**: Sincronizar con audio externo o grabar audio MIDI
