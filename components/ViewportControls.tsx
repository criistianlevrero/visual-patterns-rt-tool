
import React from 'react';
import { DesktopIcon, MobileIcon, AspectRatioIcon } from './icons';

type ViewportMode = 'default' | 'desktop' | 'mobile';

interface ViewportControlsProps {
  mode: ViewportMode;
  onModeChange: (mode: ViewportMode) => void;
}

const ViewportControls: React.FC<ViewportControlsProps> = ({ mode, onModeChange }) => {
  const buttonStyle = "p-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500";
  const activeStyle = "bg-cyan-600 text-white";
  const inactiveStyle = "bg-gray-700/80 hover:bg-gray-600/80 text-gray-300";

  return (
    <div className="absolute top-3 right-3 z-10 bg-gray-800/80 backdrop-blur-sm p-1 rounded-lg flex items-center space-x-1">
      <button
        onClick={() => onModeChange('default')}
        className={`${buttonStyle} ${mode === 'default' ? activeStyle : inactiveStyle}`}
        aria-label="Vista por defecto"
        title="Vista por defecto"
      >
        <AspectRatioIcon className="w-5 h-5" />
      </button>
      <button
        onClick={() => onModeChange('desktop')}
        className={`${buttonStyle} ${mode === 'desktop' ? activeStyle : inactiveStyle}`}
        aria-label="Simular vista de escritorio"
        title="Simular vista de escritorio (16:9)"
      >
        <DesktopIcon className="w-5 h-5" />
      </button>
      <button
        onClick={() => onModeChange('mobile')}
        className={`${buttonStyle} ${mode === 'mobile' ? activeStyle : inactiveStyle}`}
        aria-label="Simular vista de móvil"
        title="Simular vista de móvil (9:16)"
      >
        <MobileIcon className="w-5 h-5" />
      </button>
    </div>
  );
};

export default ViewportControls;
