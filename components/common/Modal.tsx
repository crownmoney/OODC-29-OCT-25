import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity print:hidden"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-color)] rounded-2xl shadow-2xl border border-[var(--border-color)] w-full max-w-lg m-4"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        <div className="p-6">
          <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
            <h3 className="text-xl font-bold text-[var(--title-color)]" id="modal-title">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="text-[var(--text-color-muted)] hover:text-[var(--text-color)] transition-colors"
              aria-label="Close modal"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;