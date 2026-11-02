import React, { useMemo } from 'react';

interface ToastProps {
  status: 'idle' | 'loading' | 'success' | 'error';
  messages: {
    loading: string;
    success: string;
    error: string;
  };
  className?: string;
}

const Toast: React.FC<ToastProps> = ({ status, messages, className = '' }) => {
  const toastData = useMemo(() => {
    switch (status) {
      case 'loading':
        return { message: messages.loading, color: 'bg-blue-600', show: true };
      case 'success':
        return { message: messages.success, color: 'bg-green-600', show: true };
      case 'error':
        return { message: messages.error, color: 'bg-red-600', show: true };
      default:
        return { message: '', color: '', show: false };
    }
  }, [status, messages]);

  return (
    <div
      className={`fixed top-8 right-8 z-50 p-4 rounded-lg text-white font-semibold shadow-2xl transform transition-all duration-300 ${
        toastData.show ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      } ${toastData.color} ${className}`}
    >
      {toastData.message}
    </div>
  );
};

export default Toast;
