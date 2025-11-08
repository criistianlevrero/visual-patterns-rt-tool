
import React from 'react';
import { DesktopIcon, MobileIcon, AspectRatioIcon } from './icons';
import { Button } from './shared/Button';

type ViewportMode = 'default' | 'desktop' | 'mobile';

interface ViewportControlsProps {
  mode: ViewportMode;
  onModeChange: (mode: ViewportMode) => void;
}

const ViewportControls: React.FC<ViewportControlsProps> = ({ mode, onModeChange }) => {
  return (
    <div className="absolute top-3 right-3 z-10 bg-gray-800/80 backdrop-blur-sm p-1 rounded-lg flex items-center space-x-1">
      <Button
        variant={mode === 'default' ? 'primary' : 'secondary'}
        size="icon"
        onClick={() => onModeChange('default')}
        icon={<AspectRatioIcon className="w-5 h-5" />}
        iconOnly
        aria-label="Vista por defecto"
        title="Vista por defecto"
      />
      <Button
        variant={mode === 'desktop' ? 'primary' : 'secondary'}
        size="icon"
        onClick={() => onModeChange('desktop')}
        icon={<DesktopIcon className="w-5 h-5" />}
        iconOnly
        aria-label="Simular vista de escritorio"
        title="Simular vista de escritorio (16:9)"
      />
      <Button
        variant={mode === 'mobile' ? 'primary' : 'secondary'}
        size="icon"
        onClick={() => onModeChange('mobile')}
        icon={<MobileIcon className="w-5 h-5" />}
        iconOnly
        aria-label="Simular vista de móvil"
        title="Simular vista de móvil (9:16)"
      />
    </div>
  );
};

export default ViewportControls;
