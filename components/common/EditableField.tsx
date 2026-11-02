import React, { useState, useEffect } from 'react';
import { PencilIcon } from './IconComponents';

interface EditableFieldProps {
  value: string | number;
  onSave: (newValue: string) => void;
  className?: string;
  inputClassName?: string;
  valueClassName?: string;
  label: string;
}

const EditableField: React.FC<EditableFieldProps> = ({ value, onSave, className, inputClassName, valueClassName, label }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(String(value));

  useEffect(() => {
    setCurrentValue(String(value));
  }, [value]);

  const handleSave = () => {
    onSave(currentValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setCurrentValue(String(value));
      setIsEditing(false);
    }
  };

  return (
    <div className={`relative group ${className}`}>
      <label className="block text-xs font-medium text-[var(--text-color-muted)] print:text-gray-500">{label}</label>
      {isEditing ? (
        <input
          type="text"
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          className={`w-full bg-[var(--input-bg-color)] text-[var(--text-color)] p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--input-border-focus-color)] print:hidden ${inputClassName}`}
        />
      ) : (
        <div className="flex items-center gap-2" onClick={() => setIsEditing(true)}>
            <span className={`cursor-pointer hover:bg-white/10 p-1 rounded-md transition print:hidden ${valueClassName}`}>
              {value}
            </span>
             <span className="print:hidden opacity-40 group-hover:opacity-100 transition-opacity">
                <PencilIcon className="h-4 w-4 text-[var(--text-color-muted)]"/>
            </span>
            <span className={`hidden print:block ${valueClassName}`}>{value}</span>
        </div>
      )}
    </div>
  );
};

export default EditableField;
