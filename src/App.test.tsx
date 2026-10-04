import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 30, 10, 0)); // Wednesday
  });

  afterEach(() => vi.useRealTimers());

  it('renders the starting rank and all eight tasks', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'no_name' })).toBeInTheDocument();
    expect(screen.getByText('BEGGAR')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(8);
    expect(screen.getByText('WEEK 1')).toBeInTheDocument();
  });

  it('marks a daily task done and undoes it', () => {
    render(<App />);
    const card = screen.getByRole('article', { name: 'Reading' });
    fireEvent.click(within(card).getByRole('button', { name: '[ MARK DONE ]' }));
    expect(within(card).getByRole('button', { name: '[ DONE ✓ ]' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('+1 PENDING')).toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: '[ DONE ✓ ]' }));
    expect(within(card).getByRole('button', { name: '[ MARK DONE ]' })).toBeInTheDocument();
    expect(screen.getByText('+0 PENDING')).toBeInTheDocument();
  });

  it('shows weekly remaining counts', () => {
    render(<App />);
    const coding = screen.getByRole('article', { name: 'Coding' });
    expect(within(coding).getByText('5 LEFT THIS WEEK')).toBeInTheDocument();
    fireEvent.click(within(coding).getByRole('button', { name: '[ MARK DONE ]' }));
    expect(within(coding).getByText('4 LEFT THIS WEEK')).toBeInTheDocument();
  });

  it('counts chores up and down', () => {
    render(<App />);
    const chores = screen.getByRole('article', { name: 'House Chores' });
    const minus = within(chores).getByRole('button', { name: 'Remove one House Chores' });
    const plus = within(chores).getByRole('button', { name: 'Add one House Chores' });
    expect(minus).toBeDisabled();

    fireEvent.click(plus);
    fireEvent.click(plus);
    expect(within(chores).getByText('2')).toBeInTheDocument();
    expect(within(chores).getByText('2 LEFT THIS WEEK')).toBeInTheDocument();
    expect(screen.getByText('+2 PENDING')).toBeInTheDocument();

    fireEvent.click(minus);
    expect(within(chores).getByText('1')).toBeInTheDocument();
  });
  it('counts today as missed on weekly tasks until it is done', () => {
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0)); // Sunday
    render(<App />);
    const coding = screen.getByRole('article', { name: 'Coding' });
    expect(within(coding).getByText(/WILL MISS 5/)).toBeInTheDocument();
    fireEvent.click(within(coding).getByRole('button', { name: '[ MARK DONE ]' }));
    expect(within(coding).getByText(/WILL MISS 4/)).toBeInTheDocument();
    fireEvent.click(within(coding).getByRole('button', { name: '[ DONE ✓ ]' }));
    expect(within(coding).getByText(/WILL MISS 5/)).toBeInTheDocument();
  });

  it('renames the player and keeps the name after a reload', () => {
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'no_name' }));
    const input = screen.getByRole('textbox', { name: 'Player name' });
    fireEvent.change(input, { target: { value: 'Aragorn' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('heading', { name: 'Aragorn' })).toBeInTheDocument();

    unmount();
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Aragorn' })).toBeInTheDocument();
  });
});
