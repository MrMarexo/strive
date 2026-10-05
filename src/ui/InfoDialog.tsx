import { useEffect, useRef } from 'react';

interface InfoDialogProps {
  title: string;
  text: string;
  onClose: () => void;
}

export function InfoDialog({ title, text, onClose }: InfoDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-top">
          <h2 id="info-dialog-title" className="dialog-title">
            {title}
          </h2>
          <button ref={closeRef} type="button" className="btn" aria-label="Close" onClick={onClose}>
            [ X ]
          </button>
        </div>
        <p>{text}</p>
      </div>
    </div>
  );
}
