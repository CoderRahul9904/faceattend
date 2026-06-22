import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prevToasts) => [...prevToasts, { id, message, type }]);

    // Auto dismiss after 3.5s
    setTimeout(() => {
      removeToast(id);
    }, 3500);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}

      {/* Floating Toast Container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => {
          let Icon = Info;
          let bgColor = 'bg-white border-blue-100 text-gray-800';
          let iconColor = 'text-[#3B5BDB]';

          if (toast.type === 'success') {
            Icon = CheckCircle;
            bgColor = 'bg-emerald-50 border-emerald-100 text-emerald-900';
            iconColor = 'text-emerald-500';
          } else if (toast.type === 'error') {
            Icon = AlertCircle;
            bgColor = 'bg-red-50 border-red-100 text-red-900';
            iconColor = 'text-red-500';
          } else if (toast.type === 'warning') {
            Icon = AlertTriangle;
            bgColor = 'bg-amber-50 border-amber-100 text-amber-900';
            iconColor = 'text-amber-500';
          }

          return (
            <div
              key={toast.id}
              onClick={() => removeToast(toast.id)}
              className={`flex items-start gap-3 p-4 border rounded-xl shadow-lg pointer-events-auto cursor-pointer transition-all duration-300 transform translate-x-0 hover:scale-[1.02] ${bgColor}`}
              role="alert"
            >
              <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconColor}`} />
              <div className="flex-1 text-xs font-semibold select-none leading-relaxed">
                {toast.message}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeToast(toast.id);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
