import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { STORAGE_KEY, freshState } from './storage/persist';
import { seedTasks } from './domain/tasks';

describe('App', () => {
  beforeEach(() => {
    window.location.hash = '';
    localStorage.clear();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...freshState('2026-09-30'), tasks: seedTasks('2026-09-28') }));
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
    expect(within(card).getByRole('button', { name: '[ DONE ]' })).toHaveAttribute('aria-pressed', 'true');
    const done = within(card).getByRole('button', { name: '[ DONE ]' });
    expect(done).not.toHaveTextContent('✓');
    expect(done.querySelector('svg.check rect')).not.toBeNull();
    expect(screen.getByText('+1 PENDING')).toBeInTheDocument();

    fireEvent.click(within(card).getByRole('button', { name: '[ DONE ]' }));
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
    fireEvent.click(within(coding).getByRole('button', { name: '[ DONE ]' }));
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

  it('opens the rank page from the hash and goes back home', () => {
    window.location.hash = '#/ranks/beggar';
    render(<App />);
    expect(screen.getByRole('region', { name: 'Beggar rank' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Reading' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '[ < BACK ]' }));
    act(() => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
    expect(window.location.hash).toBe('#/');
    expect(screen.getByRole('article', { name: 'Reading' })).toBeInTheDocument();
  });

  it('links the header rank title to the current rank page', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: 'BEGGAR' })).toHaveAttribute('href', '#/ranks/beggar');
  });

  it('shows the current rank for an unknown slug', () => {
    window.location.hash = '#/ranks/emperor';
    render(<App />);
    expect(screen.getByRole('region', { name: 'Beggar rank' })).toBeInTheDocument();
  });

  it('keeps counting days at midnight while the rank page is open', () => {
    vi.setSystemTime(new Date(2026, 8, 30, 23, 59, 58));
    window.location.hash = '#/ranks/beggar';
    render(<App />);
    expect(screen.getByText('DAY AS BEGGAR: 1')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3_000));
    expect(screen.getByText('DAYS AS BEGGAR: 2')).toBeInTheDocument();
  });

  it('groups the dashboard into daily, weekly and no-day-limit sections', () => {
    render(<App />);
    const names = (title: string) =>
      within(screen.getByRole('region', { name: title }))
        .getAllByRole('article')
        .map((a) => a.getAttribute('aria-label'));
    expect(names('DAILY')).toEqual(['Reading', 'Running', 'Abstinence', 'Logic Workout', 'Language Learning']);
    expect(names('WEEKLY')).toEqual(['Coding', 'Sport & Exercise']);
    expect(names('WEEKLY · NO DAY LIMIT')).toEqual(['House Chores']);
    expect(screen.queryByText(/-2/)).not.toBeInTheDocument();
  });

  it('drops the redundant DAILY label from daily cards', () => {
    render(<App />);
    expect(within(screen.getByRole('article', { name: 'Reading' })).queryByText('DAILY')).not.toBeInTheDocument();
  });

  it('explains a section in a popup, closed with Escape, returning focus', () => {
    render(<App />);
    const info = screen.getByRole('button', { name: 'About DAILY tasks' });
    fireEvent.click(info);
    const dialog = screen.getByRole('dialog', { name: 'DAILY' });
    expect(within(dialog).getByText(/Do each of these once every day/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(info).toHaveFocus();
  });

  it('closes the popup with its close button or a click outside, not inside', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'About WEEKLY tasks' }));
    const weekly = screen.getByRole('dialog', { name: 'WEEKLY' });
    expect(within(weekly).getByText(/counts at most once per day/)).toBeInTheDocument();
    fireEvent.click(within(weekly).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'About WEEKLY · NO DAY LIMIT tasks' }));
    const unlimited = screen.getByRole('dialog', { name: 'WEEKLY · NO DAY LIMIT' });
    expect(within(unlimited).getByText(/extras earn nothing/)).toBeInTheDocument();
    fireEvent.click(unlimited);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(unlimited.parentElement!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
