import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: ModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const pressInside = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Mount-only: focusing again on every render would pull focus out of form fields.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    // A click outside closes only if the press also started outside: a drag that begins on
    // the editor grid and ends on the backdrop must not discard the drawing.
    <div
      className="backdrop"
      onPointerDown={(event) => {
        pressInside.current = event.target !== event.currentTarget;
      }}
      onClick={() => {
        if (!pressInside.current) onClose();
        pressInside.current = false;
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-top">
          <h2 id={titleId} className="dialog-title">
            {title}
          </h2>
          <button ref={closeRef} type="button" className="btn" aria-label="Close" onClick={onClose}>
            [ X ]
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
