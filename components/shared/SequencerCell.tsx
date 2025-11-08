import React from 'react';

export type CellVariant = 'pattern' | 'step' | 'keyframe';

interface SequencerCellProps {
  variant?: CellVariant;
  active?: boolean;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const baseStyles = 'rounded-lg transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500';

const variantStyles: Record<CellVariant, string> = {
  pattern: 'border-2',
  step: 'min-w-[2.5rem] min-h-[2.5rem] flex items-center justify-center font-medium text-sm',
  keyframe: 'min-w-[2.5rem] min-h-[2.5rem] flex items-center justify-center',
};

const getStateStyles = (variant: CellVariant, active: boolean, selected: boolean, disabled: boolean): string => {
  if (disabled) {
    return 'bg-gray-800 text-gray-600 cursor-not-allowed';
  }

  if (variant === 'pattern') {
    if (active) {
      return 'bg-cyan-600 border-cyan-400 shadow-lg shadow-cyan-500/30';
    }
    return 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-gray-500';
  }

  if (variant === 'step') {
    if (selected) {
      return 'bg-yellow-500 text-gray-900 font-bold';
    }
    if (active) {
      return 'bg-cyan-600 text-white hover:bg-cyan-500';
    }
    return 'bg-gray-700 text-gray-400 hover:bg-gray-600';
  }

  if (variant === 'keyframe') {
    if (selected) {
      return 'bg-yellow-500 hover:bg-yellow-400';
    }
    if (active) {
      return 'bg-cyan-600 hover:bg-cyan-500';
    }
    return 'bg-gray-700 hover:bg-gray-600';
  }

  return '';
};

export const SequencerCell: React.FC<SequencerCellProps> = ({
  variant = 'pattern' as CellVariant,
  active = false,
  selected = false,
  disabled = false,
  onClick,
  className = '',
  children,
}) => {
  const stateStyles = getStateStyles(variant, active, selected, disabled);
  
  return (
    <button
      type="button"
      className={`${baseStyles} ${variantStyles[variant]} ${stateStyles} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default SequencerCell;
