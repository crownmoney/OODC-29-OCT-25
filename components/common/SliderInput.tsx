import React, { useState, useEffect } from 'react';

interface SliderInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  className?: string;
}

const SliderInput: React.FC<SliderInputProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
  className = ''
}) => {
  const [inputValue, setInputValue] = useState<string>(value.toString());

  useEffect(() => {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed) && parsed === value) {
      // If the current typed value evaluates to the incoming value, do not override
      // This allows the user to type "5." or "5.0" without it being snapped to "5" mid-typing.
    } else if (inputValue === '' && value === 0) {
      // Allow the input to be empty if value is 0 and we erased it
    } else {
      setInputValue(value.toString());
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setInputValue(newVal);
    
    if (newVal === '') {
      onChange(0);
      return;
    }
    
    const parsed = parseFloat(newVal);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    if (inputValue === '') {
      const boundedVal = Math.max(min, Math.min(max, 0));
      setInputValue(boundedVal.toString());
      onChange(boundedVal);
    } else {
      let parsed = parseFloat(inputValue);
      if (isNaN(parsed)) parsed = min;
      const boundedVal = Math.max(min, Math.min(max, parsed));
      setInputValue(boundedVal.toString());
      onChange(boundedVal);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFloat(e.target.value);
    onChange(parsed);
    setInputValue(parsed.toString());
  };

  const formatValue = (val: number) => {
    if (unit === '$') {
      return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
    }
    return `${val}${unit}`;
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-[var(--text-color)]">{label}</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            min={min}
            max={max}
            step={step}
            className="w-24 bg-[var(--input-bg-color)] p-1 rounded border border-[var(--input-border-color)] text-right text-sm focus:outline-none focus:ring-1 focus:ring-[var(--title-color)]"
          />
          <span className="text-xs text-[var(--text-color-muted)]">{unit}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleSliderChange}
          className="flex-grow h-2 bg-[var(--slider-track-color)] rounded-lg appearance-none cursor-pointer accent-[var(--title-color)]"
        />
      </div>
      <div className="flex justify-between text-[10px] text-[var(--text-color-muted)] uppercase tracking-wider">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
    </div>
  );
};

export default SliderInput;
