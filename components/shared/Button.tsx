import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  icon?: React.ReactNode;
  iconOnly?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-lg hover:shadow-cyan-500/30 disabled:bg-gray-600 disabled:shadow-none',
  secondary: 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white disabled:bg-gray-700 disabled:text-gray-500',
  danger: 'bg-red-600/80 hover:bg-red-600 text-white disabled:bg-gray-600 disabled:text-gray-500',
  ghost: 'bg-transparent hover:bg-gray-700 text-gray-400 hover:text-gray-300',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
  icon: 'p-2',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  children,
  icon,
  iconOnly = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:cursor-not-allowed';
  
  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className={iconOnly ? '' : 'flex-shrink-0'}>{icon}</span>}
      {!iconOnly && children}
    </button>
  );
};

export default Button;
