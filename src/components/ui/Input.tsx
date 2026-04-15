import React, { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  icon,
  fullWidth = false,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  const widthClass = fullWidth ? 'w-full' : '';
  
  return (
    <div className={`${widthClass} relative`}> 
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/70">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          placeholder={label ? ' ' : props.placeholder}
          className={`
            peer block w-full rounded-3xl border border-white/10 bg-[#0f172a] px-4 py-4 text-white placeholder-transparent shadow-inner shadow-black/20 transition duration-200
            focus:border-[#ff4d8d] focus:bg-[#111827] focus:outline-none focus:ring-2 focus:ring-[#ff4d8d]/30
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : ''}
            ${icon ? 'pl-11' : ''}
            ${className}
          `}
          {...props}
        />
        {label && (
          <label
            htmlFor={inputId}
            className={
              `absolute left-4 top-4 origin-left text-sm text-white/40 transition-all duration-200 pointer-events-none ${
                icon ? 'left-11' : ''
              } peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-placeholder-shown:text-white/40 peer-focus:-top-2 peer-focus:text-xs peer-focus:text-[#ff4d8d] ${
                error ? 'peer-focus:text-red-500' : ''
              }`
            }
          >
            {label}
          </label>
        )}
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;