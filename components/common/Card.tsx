import React from 'react';

interface CardProps {
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  titleClassName?: string;
  style?: React.CSSProperties;
}

const Card: React.FC<CardProps> = ({ title, children, className = '', titleClassName = '', style }) => {
  return (
    <div style={style} className={`bg-[var(--card-bg-color)] border border-[var(--border-color)] rounded-xl p-4 sm:p-6 shadow-lg print:border-gray-300 print:shadow-none ${className}`}>
      {title && (
        <h3 className={`text-lg font-bold text-[var(--title-color)] mb-4 print:text-black ${titleClassName}`}>
          {title}
        </h3>
      )}
      {children}
    </div>
  );
};

export default Card;