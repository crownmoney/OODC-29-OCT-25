import React from 'react';

interface TooltipProps {
  children: React.ReactNode;
  text: string;
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({ children, text, className = '' }) => {
  return (
    <div className={`relative flex items-center group ${className}`}>
      {children}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-slate-800 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none dark:bg-slate-200 dark:text-slate-900 print:hidden">
        {text}
        <svg className="absolute text-slate-800 h-2 w-full left-0 top-full dark:text-slate-200" x="0px" y="0px" viewBox="0 0 255 255">
          <polygon className="fill-current" points="0,0 127.5,127.5 255,0"/>
        </svg>
      </div>
    </div>
  );
};

export default Tooltip;
