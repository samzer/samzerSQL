import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-pastel-text-primary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full px-3 py-2 text-sm
            bg-white border rounded-lg
            text-pastel-text-primary placeholder-pastel-text-muted
            focus:outline-none focus:ring-2 focus:ring-pastel-accent-blue focus:border-transparent
            disabled:bg-pastel-bg-secondary disabled:cursor-not-allowed
            ${error ? 'border-pastel-status-error' : 'border-pastel-border-medium'}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="text-xs text-pastel-status-error-text">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
