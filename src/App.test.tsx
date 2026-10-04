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
    expect(screen.getByRole('heading', { name: 'BEGGAR' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(8);
    expect(screen.getByText(/WEEK OF SEP 28/)).toBeInTheDocument();
  });

  it('marks a daily task done and undoes it', () => {
    render(<App />);
    const card = screen.getByRole('article', { name: 'Reading' });
    fireEvent.click(within(card).getByRole('button', { name: '[ MARK DONE ]' }));
    expect(within(card).getByRole('button', { name: '[ DONE ✓ ]' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/TODAY: \+1 PENDING/)).toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: '[ DONE ✓ ]' }));
    expect(within(card).getByRole('button', { name: '[ MARK DONE ]' })).toBeInTheDocument();
    expect(screen.getByText(/TODAY: \+0 PENDING/)).toBeInTheDocument();
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
    expect(screen.getByText(/TODAY: \+2 PENDING/)).toBeInTheDocument();

    fireEvent.click(minus);
    expect(within(chores).getByText('1')).toBeInTheDocument();
  });
  it('warns how many weekly sessions will be missed', () => {
    vi.setSystemTime(new Date(2026, 9, 4, 10, 0)); // Sunday
    render(<App />);
    const coding = screen.getByRole('article', { name: 'Coding' });
    expect(within(coding).getByText(/WILL MISS 4/)).toBeInTheDocument();
  });
});
