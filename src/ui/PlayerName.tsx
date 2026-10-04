import { useRef, useState } from 'react';
import { MAX_NAME_LENGTH } from '../domain/actions';

interface PlayerNameProps {
  name: string;
  onRename: (name: string) => void;
}

export function PlayerName({ name, onRename }: PlayerNameProps) {
  const [draft, setDraft] = useState<string | null>(null);
  // Escape unmounts the input, which can still fire a blur; this stops that blur saving.
  const cancelled = useRef(false);

  if (draft === null) {
    return (
      <h1 className="player">
        <button
          type="button"
          className="player-name"
          title="Click to change name"
          onClick={() => {
            cancelled.current = false;
            setDraft(name);
          }}
        >
          {name}
        </button>
        <span className="cursor" aria-hidden="true">▮</span>
      </h1>
    );
  }

  const commit = () => {
    if (cancelled.current) return;
    onRename(draft);
    setDraft(null);
  };

  return (
    <h1 className="player">
      <input
        className="player-input"
        aria-label="Player name"
        value={draft}
        maxLength={MAX_NAME_LENGTH}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            cancelled.current = true;
            setDraft(null);
          }
        }}
      />
    </h1>
  );
}
