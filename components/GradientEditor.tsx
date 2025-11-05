
import React from 'react';
import { PlusIcon, TrashIcon, SplitIcon } from './icons';
import { useTextureStore } from '../store';
import type { GradientColor } from '../types';

const GradientEditor: React.FC = () => {
  // FIX: Explicitly type state in selector to fix type inference issue.
  const { colors } = useTextureStore((state: ReturnType<typeof useTextureStore.getState>) => ({
    colors: state.currentSettings.gradientColors
  }));

  const setColors = (newColors: GradientColor[]) => {
    // FIX: Explicitly typing the selector above also fixes the type inference for getState(), resolving the error on the next line.
    useTextureStore.getState().setCurrentSetting('gradientColors', newColors);
  }

  const handleColorChange = (id: string, newColor: string) => {
    setColors(colors.map(c => (c.id === id ? { ...c, color: newColor } : c)));
  };
  
  const handleHardStopToggle = (id: string) => {
    setColors(colors.map(c => (c.id === id ? { ...c, hardStop: !c.hardStop } : c)));
  };

  const addColor = () => {
    // Adds a new color stop at the end.
    setColors([...colors, { id: crypto.randomUUID(), color: '#ffffff', hardStop: false }]);
  };

  const removeColor = (id:string) => {
    if (colors.length <= 2) {
      // A gradient needs at least 2 colors.
      alert("Un gradiente necesita al menos 2 colores.");
      return;
    }
    setColors(colors.filter(c => c.id !== id));
  };
  
  const generateGradientCss = (colors: GradientColor[]) => {
      if (!colors || colors.length === 0) return 'transparent';
      if (colors.length === 1) return colors[0].color;

      const stops = [];
      colors.forEach((c, i) => {
          const position = i / (colors.length - 1) * 100;
          if (i > 0 && c.hardStop) {
              stops.push(`${colors[i-1].color} ${position}%`);
          }
          stops.push(`${c.color} ${position}%`);
      });
      
      return `linear-gradient(to right, ${stops.join(', ')})`;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-md font-semibold text-gray-200">Editor de Gradiente</h3>
        <button
          onClick={addColor}
          className="flex items-center space-x-2 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-1 px-3 rounded-md transition-colors"
          aria-label="Añadir color"
        >
            <PlusIcon className="w-4 h-4" />
            <span>Añadir</span>
        </button>
      </div>

      <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
        {colors.map((color, index) => (
          <div key={color.id} className="flex items-center space-x-3">
             <input
                type="color"
                value={color.color}
                onChange={(e) => handleColorChange(color.id, e.target.value)}
                className="p-0 border-2 border-gray-600 rounded-md cursor-pointer appearance-none bg-transparent w-8 h-8 flex-shrink-0"
                style={{'backgroundColor': color.color}}
                aria-label={`Color ${index + 1}`}
            />
            <span className="flex-grow font-mono text-gray-400 select-all">{color.color.toUpperCase()}</span>
            <button
                onClick={() => handleHardStopToggle(color.id)}
                className={`p-2 rounded-md transition-colors ${color.hardStop ? 'bg-cyan-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-300'}`}
                title={color.hardStop ? "Suavizar transición de color" : "Crear quiebre de color"}
                aria-pressed={color.hardStop}
                aria-label={color.hardStop ? `Suavizar transición para el color ${index + 1}` : `Crear quiebre para el color ${index + 1}`}
            >
                <SplitIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => removeColor(color.id)}
              className="p-2 text-gray-500 hover:text-red-400 disabled:text-gray-700 disabled:cursor-not-allowed transition-colors"
              disabled={colors.length <= 2}
              aria-label={`Eliminar color ${index + 1}`}
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
      <div
        className="w-full h-8 rounded-md border border-gray-700"
        style={{ background: generateGradientCss(colors) }}
        aria-label="Previsualización del gradiente"
       ></div>
    </div>
  );
};

export default GradientEditor;