import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './Header';

function renderHeader(over: Partial<Parameters<typeof Header>[0]> = {}) {
  const props = { playerName: 'Aragorn', points: 80, pending: 4, weekNumber: 3, onRename: vi.fn(), ...over };
  render(<Header {...props} />);
  return props;
}

describe('Header', () => {
  it('shows name, rank, points, pending, progress and week number', () => {
    renderHeader();
    expect(screen.getByRole('heading', { name: 'Aragorn' })).toBeInTheDocument();
    expect(screen.getByText('KNIGHT')).toBeInTheDocument();
    expect(screen.getByText('80 PTS')).toBeInTheDocument();
    expect(screen.getByText('+4 PENDING')).toBeInTheDocument();
    expect(screen.getByText('25 TO RANGER')).toBeInTheDocument();
    expect(screen.getByText('▓▓▓')).toBeInTheDocument();
    expect(screen.getByText('WEEK 3')).toBeInTheDocument();
  });

  it('shows MAX RANK at the top', () => {
    renderHeader({ points: 600 });
    expect(screen.getByText('LEGEND OF THE REALM')).toBeInTheDocument();
    expect(screen.getByText('MAX RANK')).toBeInTheDocument();
  });

  it('edits the name on click and saves on Enter', () => {
    const { onRename } = renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Aragorn' }));
    const input = screen.getByRole('textbox', { name: 'Player name' });
    expect(input).toHaveValue('Aragorn');
    fireEvent.change(input, { target: { value: 'Gimli' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('Gimli');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('saves when the input loses focus', () => {
    const { onRename } = renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Aragorn' }));
    const input = screen.getByRole('textbox', { name: 'Player name' });
    fireEvent.change(input, { target: { value: 'Legolas' } });
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledWith('Legolas');
  });

  it('cancels on Escape without saving', () => {
    const { onRename } = renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Aragorn' }));
    const input = screen.getByRole('textbox', { name: 'Player name' });
    fireEvent.change(input, { target: { value: 'Sauron' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Aragorn' })).toBeInTheDocument();
  });

  it('links the rank title to its rank page', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: 'KNIGHT' })).toHaveAttribute('href', '#/ranks/knight');
  });
});
