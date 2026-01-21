import { SelectHTMLAttributes, forwardRef } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-pastel-text-primary">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`
            w-full px-3 py-2 text-sm
            bg-white border rounded-lg
            text-pastel-text-primary
            focus:outline-none focus:ring-2 focus:ring-pastel-accent-blue focus:border-transparent
            disabled:bg-pastel-bg-secondary disabled:cursor-not-allowed
            ${error ? 'border-pastel-status-error' : 'border-pastel-border-medium'}
            ${className}
          `}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-xs text-pastel-status-error-text">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
