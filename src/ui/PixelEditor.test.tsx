import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PixelEditor } from './PixelEditor';

const BOOK = ['..........', '.###..###.', '#...##...#', '#.#.##.#.#', '#...##...#', '#.#.##.#.#', '#...##...#', '####..####', '...####...', '..........'];
const cell = (row: number, col: number) => screen.getByRole('button', { name: new RegExp(`^Pixel row ${row}, column ${col},`) });
const paint = (row: number, col: number) => {
  fireEvent.pointerDown(cell(row, col));
  fireEvent.pointerUp(cell(row, col));
};

function renderEditor(props: Partial<Parameters<typeof PixelEditor>[0]> = {}) {
  const handlers = { onSave: vi.fn(), onCancel: vi.fn() };
  render(<PixelEditor images={[{ key: 'book', label: 'book', map: BOOK }]} {...handlers} {...props} />);
  return handlers;
}

describe('PixelEditor', () => {
  it('paints with a stroke, previews it and saves only when not blank', () => {
    const { onSave } = renderEditor();
    const save = screen.getByRole('button', { name: '[ SAVE IMAGE ]' });
    expect(save).toBeDisabled();
    paint(1, 1);
    expect(cell(1, 1)).toHaveAccessibleName('Pixel row 1, column 1, filled');
    expect(screen.getByRole('img', { name: 'Preview' }).querySelectorAll('rect')).toHaveLength(1);
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith(['#.........', ...Array(9).fill('..........')]);
  });

  it('erases when a stroke starts on a filled pixel', () => {
    renderEditor();
    paint(1, 1);
    paint(1, 1);
    expect(cell(1, 1)).toHaveAccessibleName('Pixel row 1, column 1, empty');
  });

  it('paints every cell a drag passes over', () => {
    renderEditor();
    const grid = screen.getByRole('group', { name: 'Pixel grid' });
    grid.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(cell(1, 1));
    fireEvent.pointerMove(grid, { clientX: 15, clientY: 5 });
    fireEvent.pointerMove(grid, { clientX: 25, clientY: 5 });
    fireEvent.pointerUp(grid);
    expect(cell(1, 2)).toHaveAccessibleName('Pixel row 1, column 2, filled');
    expect(cell(1, 3)).toHaveAccessibleName('Pixel row 1, column 3, filled');
    fireEvent.click(screen.getByRole('button', { name: '[ UNDO ]' }));
    expect(cell(1, 1)).toHaveAccessibleName('Pixel row 1, column 1, empty');
    expect(cell(1, 3)).toHaveAccessibleName('Pixel row 1, column 3, empty');
  });

  it('undoes and redoes with buttons and Ctrl/Cmd+Z', () => {
    renderEditor();
    const undo = screen.getByRole('button', { name: '[ UNDO ]' });
    const redo = screen.getByRole('button', { name: '[ REDO ]' });
    expect(undo).toBeDisabled();
    paint(1, 1);
    paint(2, 2);
    fireEvent.click(undo);
    expect(cell(2, 2)).toHaveAccessibleName(/empty/);
    expect(cell(1, 1)).toHaveAccessibleName(/filled/);
    fireEvent.click(redo);
    expect(cell(2, 2)).toHaveAccessibleName(/filled/);
    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    expect(cell(2, 2)).toHaveAccessibleName(/empty/);
    fireEvent.keyDown(window, { key: 'Z', ctrlKey: true, shiftKey: true });
    expect(cell(2, 2)).toHaveAccessibleName(/filled/);
    expect(redo).toBeDisabled();
  });

  it('clears as one undoable step', () => {
    renderEditor({ initial: BOOK });
    const clear = screen.getByRole('button', { name: '[ CLEAR ]' });
    fireEvent.click(clear);
    expect(screen.getByRole('button', { name: '[ SAVE IMAGE ]' })).toBeDisabled();
    expect(clear).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '[ UNDO ]' }));
    expect(cell(3, 1)).toHaveAccessibleName(/filled/);
  });

  it('copies an existing image into the grid', () => {
    const { onSave } = renderEditor();
    fireEvent.click(screen.getByRole('button', { name: '[ COPY FROM... ]' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy book' }));
    expect(screen.queryByRole('button', { name: 'Copy book' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '[ SAVE IMAGE ]' }));
    expect(onSave).toHaveBeenCalledWith(BOOK);
  });

  it('moves between pixels with arrow keys and toggles with Space or Enter', () => {
    renderEditor();
    const first = cell(1, 1);
    expect(first).toHaveAttribute('tabindex', '0');
    expect(cell(1, 2)).toHaveAttribute('tabindex', '-1');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(cell(1, 2)).toHaveFocus();
    fireEvent.keyDown(cell(1, 2), { key: 'ArrowDown' });
    expect(cell(2, 2)).toHaveFocus();
    fireEvent.keyDown(cell(2, 2), { key: ' ' });
    expect(cell(2, 2)).toHaveAccessibleName(/filled/);
    fireEvent.keyDown(cell(2, 2), { key: 'Enter' });
    expect(cell(2, 2)).toHaveAccessibleName(/empty/);
    fireEvent.keyDown(cell(2, 2), { key: 'ArrowLeft' });
    fireEvent.keyDown(cell(2, 1), { key: 'ArrowLeft' });
    expect(cell(2, 1)).toHaveFocus();
  });

  it('in edit mode shows users and only allows deleting an unused image', () => {
    const onDelete = vi.fn();
    const { onCancel } = renderEditor({ initial: BOOK, usedBy: ['Coding', 'Reading'], onDelete });
    expect(screen.getByText('USED BY: CODING, READING')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '[ DELETE ]' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '[ CANCEL ]' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('deletes an unused image', () => {
    const onDelete = vi.fn();
    renderEditor({ initial: BOOK, usedBy: [], onDelete });
    expect(screen.getByText('NOT USED BY ANY TASK')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '[ DELETE ]' }));
    expect(onDelete).toHaveBeenCalled();
  });
});
