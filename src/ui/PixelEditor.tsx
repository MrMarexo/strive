import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  GRID_SIZE, blankGrid, cellFromPoint, emptyHistory, isBlank, isFilled, pushHistory, redoGrid, sameGrid, setCell, undoGrid,
  type Grid, type History,
} from './pixelGrid';
import { PixelSprite } from './PixelSprite';

interface PixelEditorProps {
  initial?: string[]; // edit mode starts from the image's current map
  images: { key: string; label: string; map: string[] }[]; // "copy from" sources
  usedBy?: string[]; // edit mode only
  onSave: (map: string[]) => void;
  onCancel: () => void;
  onDelete?: () => void; // edit mode only
}

interface Doc {
  grid: Grid;
  history: History;
}

const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

function cellOf(target: EventTarget): { row: number; col: number } | null {
  const el = (target as HTMLElement).closest?.('[data-row]') as HTMLElement | null;
  return el ? { row: Number(el.dataset.row), col: Number(el.dataset.col) } : null;
}

export function PixelEditor({ initial, images, usedBy, onSave, onCancel, onDelete }: PixelEditorProps) {
  const [doc, setDoc] = useState<Doc>(() => ({ grid: initial ? [...initial] : blankGrid(), history: emptyHistory() }));
  const [copying, setCopying] = useState(false);
  const [focus, setFocus] = useState({ row: 0, col: 0 });
  const stroke = useRef<{ filled: boolean; before: Grid } | null>(null);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const keyboardMove = useRef(false);

  // All edits go through pure updaters, so StrictMode's double-run can't record a step twice.
  const step = (change: (grid: Grid) => Grid) =>
    setDoc((d) => {
      const next = change(d.grid);
      return sameGrid(next, d.grid) ? d : { grid: next, history: pushHistory(d.history, d.grid) };
    });
  const undo = () => setDoc((d) => undoGrid(d.history, d.grid) ?? d);
  const redo = () => setDoc((d) => redoGrid(d.history, d.grid) ?? d);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Opening the editor hides the button that opened it, so move focus onto the grid.
  useEffect(() => {
    cells.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (!keyboardMove.current) return;
    keyboardMove.current = false;
    cells.current[focus.row * GRID_SIZE + focus.col]?.focus();
  }, [focus]);

  const paintAt = (row: number, col: number, filled: boolean) =>
    setDoc((d) => ({ ...d, grid: setCell(d.grid, row, col, filled) }));

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const cell = cellOf(event.target);
    if (!cell) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const filled = !isFilled(doc.grid, cell.row, cell.col);
    stroke.current = { filled, before: doc.grid };
    setFocus(cell);
    paintAt(cell.row, cell.col, filled);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!stroke.current) return;
    const cell = cellFromPoint(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY);
    if (cell) paintAt(cell.row, cell.col, stroke.current.filled);
  };

  const endStroke = () => {
    const current = stroke.current;
    if (!current) return;
    stroke.current = null;
    setDoc((d) => (sameGrid(current.before, d.grid) ? d : { ...d, history: pushHistory(d.history, current.before) }));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = ARROWS[event.key];
    if (move) {
      event.preventDefault();
      keyboardMove.current = true;
      setFocus((f) => ({
        row: Math.min(GRID_SIZE - 1, Math.max(0, f.row + move[0])),
        col: Math.min(GRID_SIZE - 1, Math.max(0, f.col + move[1])),
      }));
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      const { row, col } = focus;
      step((grid) => setCell(grid, row, col, !isFilled(grid, row, col)));
    }
  };

  const blank = isBlank(doc.grid);

  return (
    <div className="pixel-editor">
      <div className="editor-main">
        <div
          className="pixel-grid"
          role="group"
          aria-label="Pixel grid"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onKeyDown={onKeyDown}
        >
          {doc.grid.flatMap((line, row) =>
            [...line].map((ch, col) => (
              <button
                key={`${row}-${col}`}
                ref={(el) => {
                  cells.current[row * GRID_SIZE + col] = el;
                }}
                type="button"
                className={ch === '#' ? 'pixel filled' : 'pixel'}
                data-row={row}
                data-col={col}
                tabIndex={focus.row === row && focus.col === col ? 0 : -1}
                aria-label={`Pixel row ${row + 1}, column ${col + 1}, ${ch === '#' ? 'filled' : 'empty'}`}
              />
            )),
          )}
        </div>
        <div className="editor-preview">
          <span className="meta">PREVIEW</span>
          <PixelSprite map={doc.grid} title="Preview" size={80} />
        </div>
      </div>

      <div className="editor-tools">
        <button type="button" className="btn" disabled={doc.history.past.length === 0} onClick={undo}>
          [ UNDO ]
        </button>
        <button type="button" className="btn" disabled={doc.history.future.length === 0} onClick={redo}>
          [ REDO ]
        </button>
        <button type="button" className="btn" disabled={blank} onClick={() => step(() => blankGrid())}>
          [ CLEAR ]
        </button>
        <button type="button" className="btn" aria-expanded={copying} onClick={() => setCopying((c) => !c)}>
          [ COPY FROM... ]
        </button>
      </div>

      {copying && (
        <div className="copy-row">
          {images.map((image) => (
            <button
              key={image.key}
              type="button"
              className="btn image-option"
              aria-label={`Copy ${image.label}`}
              onClick={() => {
                step(() => [...image.map]);
                setCopying(false);
              }}
            >
              <PixelSprite map={image.map} size={30} className="option-sprite" />
            </button>
          ))}
        </div>
      )}

      {usedBy && (
        <p className="note">{usedBy.length > 0 ? `USED BY: ${usedBy.join(', ').toUpperCase()}` : 'NOT USED BY ANY TASK'}</p>
      )}

      <div className="form-actions">
        <div className="action-group">
          <button type="button" className="btn" disabled={blank} onClick={() => onSave(doc.grid)}>
            [ SAVE IMAGE ]
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            [ CANCEL ]
          </button>
        </div>
        {onDelete && (
          <button type="button" className="btn" disabled={(usedBy?.length ?? 0) > 0} onClick={onDelete}>
            [ DELETE ]
          </button>
        )}
      </div>
    </div>
  );
}
