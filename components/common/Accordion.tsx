import React, { useState } from 'react';

// A simple chevron icon for the accordion
const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
    <svg className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
);

interface AccordionItem {
  title: React.ReactNode;
  content: React.ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  defaultOpenIndex?: number;
}

const Accordion: React.FC<AccordionProps> = ({ items, defaultOpenIndex = 0 }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpenIndex);

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="border border-[var(--border-color)] bg-[var(--card-bg-color)] rounded-lg overflow-hidden">
          <button
            onClick={() => toggleItem(index)}
            className={`w-full flex justify-between items-center p-4 text-left font-semibold text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--title-color)] ${openIndex === index ? 'bg-transparent text-[var(--title-color)]' : 'bg-transparent text-[var(--text-color)] hover:bg-[var(--input-bg-color)]'}`}
            aria-expanded={openIndex === index}
            aria-controls={`accordion-content-${index}`}
          >
            <span>{item.title}</span>
            <ChevronIcon isOpen={openIndex === index} />
          </button>
          <div
            id={`accordion-content-${index}`}
            className="grid transition-all duration-500 ease-in-out"
            style={{
              gridTemplateRows: openIndex === index ? '1fr' : '0fr',
            }}
            aria-hidden={openIndex !== index}
          >
            <div className="overflow-hidden">
                <div className="p-4 pt-0">
                  {item.content}
                </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Accordion;
