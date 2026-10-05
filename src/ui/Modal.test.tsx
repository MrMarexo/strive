import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  it('is a labelled dialog that focuses its close button and closes on Escape, backdrop or X', () => {
    const onClose = vi.fn();
    render(<Modal title="HELLO" onClose={onClose}><p>Body</p></Modal>);
    const dialog = screen.getByRole('dialog', { name: 'HELLO' });
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();

    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(dialog.parentElement!);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('does not steal focus back from a field when re-rendered', () => {
    const { rerender } = render(<Modal title="FORM" onClose={() => {}}><input aria-label="Field" /></Modal>);
    const field = screen.getByRole('textbox', { name: 'Field' });
    field.focus();
    rerender(<Modal title="FORM" onClose={() => {}}><input aria-label="Field" /></Modal>);
    expect(field).toHaveFocus();
  });
});
