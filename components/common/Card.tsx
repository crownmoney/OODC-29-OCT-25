
import React from 'react';

interface CardProps {
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const Card: React.FC<CardProps> = ({ title, children, className = '', style }) => {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${className}`} style={style}>
      {title && (
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-bold text-slate-900">{title}</h3>
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};

export default Card;
