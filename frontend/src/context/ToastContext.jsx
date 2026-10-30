import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

const BG_CLASSES = {
  success: 'text-bg-success',
  danger: 'text-bg-danger',
  warning: 'text-bg-warning',
  info: 'text-bg-info',
  primary: 'text-bg-primary'
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  // Messages are rendered as text by React, so API/user-provided text is
  // escaped automatically just like the original escapeHtml helper.
  const showToast = useCallback((message, type = 'primary') => {
    const id = `toast-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setToasts((current) => [...current, { id, message: String(message ?? ''), type }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3500);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div id="toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast align-items-center ${BG_CLASSES[toast.type] || 'text-bg-dark'} border-0 mb-2 shadow show`}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
          >
            <div className="d-flex">
              <div className="toast-body">{toast.message}</div>
              <button
                type="button"
                className="btn-close btn-close-white me-2 m-auto"
                onClick={() => dismiss(toast.id)}
                aria-label="Close"
              />
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside a ToastProvider');
  }
  return context;
}
