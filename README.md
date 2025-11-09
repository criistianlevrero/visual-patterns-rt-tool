# Visual Patterns RT Tool

Una aplicación web de alto rendimiento para generar patrones visuales animados en tiempo real. Diseñada para artistas visuales, VJs y creativos, esta herramienta ofrece control completo sobre renderizado WebGL/Canvas2D, integración MIDI profesional, y secuenciación avanzada de patrones.

## ✨ Características Principales

### 🎨 Sistema de Renderizado Modular
-   **Múltiples Motores de Renderizado:** WebGL (shader-based), Canvas2D, y patrones concéntricos
-   **Plugin System:** Arquitectura extensible para agregar nuevos renderers
-   **Alto Rendimiento:** Optimizado para 60 FPS con WebGL shaders
-   **Control en Tiempo Real:** Modifica parámetros y observa cambios instantáneos

### 🎭 Sistema de Patrones Avanzado
-   **Memorias de Configuración:** Guarda estados completos de controles como patrones reutilizables
-   **Transiciones Animadas:** Sistema de interpolación basado en steps con soporte de valores fraccionales (0-8)
-   **Animate Only Changes:** Solo anima propiedades que difieren entre patrones para transiciones eficientes
-   **Priority System:** Control basado en prioridades (MIDI > UI > Property Sequencer > Pattern Sequencer)

### 🎹 Integración MIDI Profesional
-   **Web MIDI API:** Soporte nativo de MIDI en el navegador (sin plugins)
-   **MIDI Learn:** Mapeo rápido de controles con feedback visual
-   **Pattern Triggering:** Carga patrones con notas MIDI (tap) o crea nuevos (hold 0.5s)
-   **Highest Priority:** MIDI puede cancelar cualquier otra animación en curso
-   **Per-Project Mappings:** Mapeos MIDI guardados con cada proyecto

### 🎬 Secuenciadores Duales
-   **Pattern Sequencer:** Grid de 8/12/16/24/32 pasos para disparar patrones en secuencia
-   **Property Sequencer:** Automatización de propiedades individuales con keyframes
-   **BPM Sync:** Timing preciso basado en BPM (30-240) con compensación de drift
-   **Combined Playback:** Ambos secuenciadores corren simultáneamente

### 🎨 Control de Gradientes
-   **Multi-Color Gradients:** Hasta 10 colores por gradiente
-   **Hard Stops:** Transiciones abruptas entre colores para efectos gráficos
-   **Shader Interpolation:** WebGL interpola gradientes suavemente durante transiciones
-   **Background + Foreground:** Control independiente de gradientes para fondo y elementos

### 🖥️ Modos de Vista
-   **Fullscreen Mode:** Interfaz auto-hide para performances en vivo (3s mouse idle)
-   **Viewport Preview:** Previsualiza diseños en diferentes aspect ratios (desktop/mobile)
-   **Responsive Layout:** Adaptable a diferentes tamaños de pantalla

### 💾 Gestión de Proyectos
-   **Auto-save:** Persistencia automática a localStorage
-   **Import/Export:** Guarda proyectos completos como JSON
-   **Version Migration:** Sistema automático de migración entre versiones
-   **Multiple Sequences:** Organiza patrones en secuencias independientes

## 🚀 Instalación y Desarrollo

### Prerrequisitos

- Node.js (v18 o superior)
- npm o yarn
- Navegador moderno con soporte de WebGL 2.0 y Web MIDI API

### Configuración Inicial

1. Clona el repositorio:
   ```bash
   git clone https://github.com/criistianlevrero/visual-patterns-rt-tool.git
   cd visual-patterns-rt-tool
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Configura las variables de entorno (opcional):
   ```bash
   cp .env.example .env
   ```
   
   Edita el archivo `.env` para personalizar tu configuración. Ver [Guía de Variables de Entorno](docs/ENVIRONMENT_VARIABLES.md) para más detalles.

4. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

5. Abre tu navegador en `http://localhost:3000`

### Variables de Entorno

El proyecto utiliza variables de entorno opcionales para configuración:

- `VITE_DEBUG_MODE`: Activa el overlay de debug (default: `false`)
- `VITE_DEBUG_SEQUENCER`: Logs de secuenciador en consola (default: `false`)
- `VITE_DEBUG_ANIMATION`: Logs de animaciones en consola (default: `false`)
- `VITE_DEBUG_PROPERTY_SEQUENCER`: Logs de automatización de propiedades (default: `false`)

Para más detalles, consulta la [documentación completa de variables de entorno](docs/ENVIRONMENT_VARIABLES.md).

### Scripts Disponibles

```bash
npm run dev      # Inicia servidor de desarrollo (Vite)
npm run build    # Compila para producción
npm run preview  # Previsualiza build de producción
```

## 📖 Guía de Uso

### 1. Selección de Renderer
-   Usa el dropdown en el header para cambiar entre diferentes motores de renderizado
-   **WebGL Renderer**: Mejor rendimiento, efectos shader avanzados
-   **Concentric Renderer**: Patrones hexagonales concéntricos animados
-   **Canvas2D Renderer**: Fallback compatible con navegadores antiguos

### 2. Controles de Renderizado
-   Ajusta parámetros específicos del renderer activo desde el panel de control
-   Cada renderer tiene sus propios controles (tamaño, espaciado, forma, velocidad, etc.)
-   Los cambios se aplican en tiempo real con prioridad UI

### 3. Edición de Gradientes
-   **Agregar colores:** Click en el botón "+" para añadir color stops
-   **Reordenar:** Arrastra los color handles para cambiar posiciones
-   **Hard Stops:** Activa checkbox para crear transiciones abruptas
-   **Eliminar:** Click en "×" (mínimo 2 colores por gradiente)

### 4. Sistema de Patrones (Memorias)
-   **Guardar Patrón Manual:** Click en **"Guardar Patrón Actual"** en el panel de control
-   **Guardar con MIDI:** Mantén pulsada una nota MIDI durante 0.5+ segundos
-   **Cargar Patrón:** Click en nombre del patrón (transición animada según interpolationSpeed)
-   **Asignar MIDI:** Click en icono MIDI del patrón → pulsa nota deseada
-   **Pattern Priority:** Cargas desde UI tienen mayor prioridad que secuenciador

### 5. Secuenciadores

#### Pattern Sequencer
1. **Configurar Steps:** Selecciona cantidad de pasos (8/12/16/24/32)
2. **Asignar Patrones:** Click en celdas del grid para toggle pattern-to-step
3. **BPM Control:** Ajusta tempo (30-240 BPM)
4. **Interpolation Speed:** Controla duración de transiciones (0-8 steps, 0=instantáneo)
5. **Play/Stop:** Botón de transport para iniciar/detener secuenciador

#### Property Sequencer
1. **Add Track:** Click "+ Agregar Pista" y selecciona propiedad
2. **Add Keyframes:** Click en steps para crear keyframes
3. **Edit Values:** Ajusta valores arrastrando o editando
4. **Remove Keyframes:** Click en keyframe existente para eliminar
5. **Automation:** Se interpola linealmente entre keyframes con wrap-around

### 6. Control MIDI

#### Conexión
1. Navega a **"Configuración MIDI"** en el panel
2. Click **"Conectar MIDI"**
3. Selecciona tu dispositivo del dropdown
4. Status indicator mostrará conexión activa

#### MIDI Learn (Control Mapping)
1. Click en icono MIDI (🎹) junto al control deseado
2. El icono se volverá naranja (learning mode)
3. Mueve un control en tu dispositivo MIDI
4. Mapeo automático - icono se vuelve cyan
5. Click en icono cyan para eliminar mapeo

#### Pattern Triggering
-   **Tap (< 0.5s):** Carga patrón asignado a esa nota
-   **Hold (> 0.5s):** Crea nuevo patrón y asigna a esa nota
-   MIDI tiene máxima prioridad - cancela animaciones en curso

### 7. Debug Tools
-   **Debug Overlay:** Click en botón 🐛 (esquina inferior derecha)
-   **Console Logging:** `window.enableDebug()` / `window.disableDebug()`
-   **Metrics:** FPS, sequencer ticks, active animations, settings changes
-   **Event Log:** Registro cronológico de eventos del sistema
-   **Export Data:** Descarga telemetría para análisis

### 8. Gestión de Proyectos
-   **Auto-save:** Cambios se guardan automáticamente en localStorage
-   **Export Project:** Descarga configuración completa como JSON
-   **Import Project:** Carga proyecto guardado (con migración de versiones)
-   **Multiple Sequences:** Crea y gestiona múltiples secuencias independientes

## 🏗️ Arquitectura

### Stack Tecnológico
-   **React 18** + **TypeScript** para UI
-   **Vite** como build tool
-   **Zustand** para state management con Immer
-   **WebGL 2.0** para rendering de alto rendimiento
-   **Web MIDI API** para integración MIDI nativa

### Estructura del Proyecto
```
src/
├── components/
│   ├── renderers/          # Sistema de plugins de renderizado
│   │   ├── webgl/          # WebGL shader renderer
│   │   ├── concentric/     # Concentric patterns renderer
│   │   └── canvas2d/       # Canvas2D fallback renderer
│   ├── controls/           # UI controls (sliders, gradients, etc.)
│   ├── sequencer/          # Pattern & property sequencers
│   ├── midi/               # MIDI console & learn components
│   └── debug/              # Debug overlay
├── store/
│   ├── slices/             # Zustand state slices
│   │   ├── animation.slice.ts    # Centralized animation system
│   │   ├── project.slice.ts      # Project management
│   │   ├── settings.slice.ts     # Pattern & settings
│   │   ├── sequencer.slice.ts    # Sequencer logic
│   │   ├── midi.slice.ts         # MIDI integration
│   │   └── ui.slice.ts           # UI state
│   └── types/              # Type definitions
└── types.ts                # Global type definitions
```

### Sistema de Animación
El proyecto implementa un sistema de animación centralizado con control basado en prioridades:

```
Priority Levels (ControlSource enum):
  MIDI (3)                → Highest priority, immediate changes
  UI (2)                  → User interactions
  PropertySequencer (1)   → Keyframe automation
  PatternSequencer (0)    → Lowest priority

Flow: requestPropertyChange(property, from, to, steps, source, interpolationType)
  → Priority check & cancellation
  → BPM-based frame calculation
  → RAF loop interpolation
  → Gradient shader transitions
```

## 🤝 Contribución

¿Quieres contribuir? ¡Genial! Por favor:

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios usando [Conventional Commits](https://www.conventionalcommits.org/)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Convenciones de Commit
-   `feat:` Nuevas características
-   `fix:` Corrección de bugs
-   `refactor:` Refactorización de código
-   `docs:` Cambios en documentación
-   `perf:` Mejoras de performance
-   `test:` Agregar o actualizar tests
-   `chore:` Tareas de mantenimiento

## 📝 Licencia

Este proyecto está licenciado bajo la **GNU General Public License v3.0** (GPL-3.0).

Eres libre de:
-   ✅ Usar este software comercialmente
-   ✅ Modificar el código fuente
-   ✅ Distribuir copias
-   ✅ Uso privado

Bajo las siguientes condiciones:
-   📄 Debes incluir la licencia y copyright notice
-   🔓 Código fuente debe estar disponible cuando distribuyes
-   🔄 Las modificaciones deben usar la misma licencia (GPL-3.0)
-   📝 Debes documentar los cambios realizados

Ver el archivo [LICENSE](LICENSE) para el texto completo de la licencia.

## 👨‍💻 Autor

**Cristian Levrero**
- GitHub: [@criistianlevrero](https://github.com/criistianlevrero)

## 🙏 Agradecimientos

-   Comunidad de VJs y artistas visuales por feedback y testing
-   Contribuidores open-source de las bibliotecas utilizadas
-   Web MIDI API specification team

---

**Versión:** 2.0.0  
**Estado:** Activo en desarrollo  
**Última actualización:** Noviembre 2025

## Tecnología Utilizada

-   React
-   Tailwind CSS
-   Web MIDI API
-   SVG para el renderizado
