



import React from 'react';
import { PlusIcon, TrashIcon, SplitIcon } from './icons';
import { Button } from './shared/Button';
import type { GradientColor } from '../types';interface GradientEditorProps {
  title: string;
  colors: GradientColor[];
  onColorsChange: (newColors: GradientColor[]) => void;
  minColors?: number;
}

const GradientEditor: React.FC<GradientEditorProps> = ({ title, colors, onColorsChange, minColors = 2 }) => {

  const handleColorChange = (id: string, newColor: string) => {
    onColorsChange(colors.map(c => (c.id === id ? { ...c, color: newColor } : c)));
  };
  
  const handleHardStopToggle = (id: string) => {
    onColorsChange(colors.map(c => (c.id === id ? { ...c, hardStop: !c.hardStop } : c)));
  };

  const addColor = () => {
    onColorsChange([...colors, { id: crypto.randomUUID(), color: '#ffffff', hardStop: false }]);
  };

  const removeColor = (id:string) => {
    if (colors.length <= minColors) {
      alert(`Un gradiente necesita al menos ${minColors} color(es).`);
      return;
    }
    onColorsChange(colors.filter(c => c.id !== id));
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
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
        <Button
          variant="primary"
          size="sm"
          onClick={addColor}
          icon={<PlusIcon className="w-3.5 h-3.5" />}
          aria-label="Añadir color"
        >
          Añadir
        </Button>
      </div>

      <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
        {colors.map((color, index) => (
          <div key={color.id} className="flex items-center space-x-2">
             <input
                type="color"
                value={color.color}
                onChange={(e) => handleColorChange(color.id, e.target.value)}
                className="p-0 border-2 border-gray-600 rounded-md cursor-pointer appearance-none bg-transparent w-7 h-7 flex-shrink-0"
                style={{'backgroundColor': color.color}}
                aria-label={`Color ${index + 1}`}
            />
            <span className="flex-grow font-mono text-gray-400 select-all text-xs">{color.color.toUpperCase()}</span>
            <Button
                variant={color.hardStop ? 'primary' : 'secondary'}
                size="icon"
                onClick={() => handleHardStopToggle(color.id)}
                icon={<SplitIcon className="w-3.5 h-3.5" />}
                iconOnly
                title={color.hardStop ? "Suavizar transición de color" : "Crear quiebre de color"}
                aria-pressed={color.hardStop}
                aria-label={color.hardStop ? `Suavizar transición para el color ${index + 1}` : `Crear quiebre para el color ${index + 1}`}
                className="w-7 h-7"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeColor(color.id)}
              icon={<TrashIcon className="w-4 h-4" />}
              iconOnly
              disabled={colors.length <= minColors}
              className="hover:text-red-400 w-7 h-7"
              aria-label={`Eliminar color ${index + 1}`}
            />
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