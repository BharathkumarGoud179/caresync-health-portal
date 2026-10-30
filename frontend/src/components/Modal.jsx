import { useEffect } from 'react';

// Lightweight replacement for Bootstrap's JS modal. It renders the same
// Bootstrap markup and keeps the same backdrop/scroll-lock behaviour without
// adding a second copy of bootstrap's JavaScript bundle.
export default function Modal({
  show,
  onClose,
  size = '',
  labelledBy,
  children,
  closeOnBackdrop = true
}) {
  useEffect(() => {
    if (!show) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = previousOverflow;
    };
  }, [show]);

  if (!show) return null;

  const handleBackdrop = (event) => {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      onClose?.();
    }
  };

  return (
    <>
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onMouseDown={handleBackdrop}
      >
        <div
          className={`modal-dialog modal-dialog-centered ${size}`}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="modal-content border-0 shadow">{children}</div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
