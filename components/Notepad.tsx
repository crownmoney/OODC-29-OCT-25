import React from 'react';
import { XMarkIcon } from './common/IconComponents';

interface NotepadProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  setContent: (content: string) => void;
}

const Notepad: React.FC<NotepadProps> = ({ isOpen, onClose, content, setContent }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed bottom-24 right-6 w-96 h-[400px] bg-[var(--card-bg-color)] border border-[var(--border-color)] rounded-xl shadow-2xl z-40 flex flex-col animate-fade-in-up print:hidden">
      <header className="flex justify-between items-center p-3 border-b border-[var(--border-color)]">
        <h3 className="font-bold text-[var(--title-color)]">Notepad</h3>
        <button onClick={onClose} className="text-[var(--text-color-muted)] hover:text-[var(--text-color)]">
          <XMarkIcon className="h-5 w-5" />
        </button>
      </header>
      <div className="flex-1 p-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type your meeting notes here..."
          className="w-full h-full bg-transparent text-[var(--text-color)] resize-none focus:outline-none p-2"
        />
      </div>
    </div>
  );
};

export default Notepad;
