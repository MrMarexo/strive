import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { STORAGE_KEY, freshState } from './storage/persist';
import { seedTasks, type TaskDef } from './domain/tasks';

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

  it('shows a task description from the card [?] and returns focus', () => {
    render(<App />);
    const info = screen.getByRole('button', { name: 'About Sport & Exercise' });
    fireEvent.click(info);
    const dialog = screen.getByRole('dialog', { name: 'SPORT & EXERCISE' });
    expect(within(dialog).getByText(/swimming, skating/)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(info).toHaveFocus();
  });

  it('falls back when a task has no description', () => {
    const tasks = seedTasks('2026-09-28').map((t) => (t.id === 'reading' ? { ...t, description: '' } : t));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...freshState('2026-09-30'), tasks }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'About Reading' }));
    expect(within(screen.getByRole('dialog', { name: 'READING' })).getByText('No description yet.')).toBeInTheDocument();
  });

  it('marks not-started tasks as STARTS MON and removed ones as RETIRES SUNDAY', () => {
    const seeds = seedTasks('2026-09-28');
    const tasks: TaskDef[] = [
      ...seeds.map((t) => (t.id === 'coding' ? { ...t, retiresAfter: '2026-10-04' } : t)),
      { ...seeds[0], id: 't-later', name: 'Meditate', startsOn: '2026-10-05' },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...freshState('2026-09-30'), tasks }));
    render(<App />);

    const later = screen.getByRole('article', { name: 'Meditate' });
    expect(within(later).getByText('STARTS MON')).toBeInTheDocument();
    expect(within(later).queryByRole('button', { name: '[ MARK DONE ]' })).not.toBeInTheDocument();

    const coding = screen.getByRole('article', { name: 'Coding' });
    expect(within(coding).getByText(/RETIRES SUNDAY/)).toBeInTheDocument();
    expect(within(coding).getByRole('button', { name: '[ MARK DONE ]' })).toBeInTheDocument();
  });

  it('adds a weekly task that starts next Monday', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'ADD WEEKLY TASK' }));
    const dialog = screen.getByRole('dialog', { name: 'NEW WEEKLY TASK' });
    const save = within(dialog).getByRole('button', { name: '[ SAVE ]' });
    expect(save).toBeDisabled();
    expect(within(dialog).getByText('STARTS NEXT MONDAY')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'NAME' }), { target: { value: 'Guitar practice' } });
    const spin = within(dialog).getByRole('spinbutton');
    expect(spin).toHaveAttribute('max', '7');
    fireEvent.change(spin, { target: { value: '99' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'guitar' }));
    expect(within(dialog).getByRole('button', { name: 'guitar' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'DESCRIPTION' }), { target: { value: 'Chords and scales.' } });
    fireEvent.click(save);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const card = within(screen.getByRole('region', { name: 'WEEKLY' })).getByRole('article', { name: 'Guitar practice' });
    expect(within(card).getByText('STARTS MON')).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!).tasks.at(-1);
    expect(saved).toMatchObject({ name: 'Guitar practice', image: 'guitar', cadence: { kind: 'weekly', target: 7 } });
  });

  it('starts a task added on a Monday right away', () => {
    vi.setSystemTime(new Date(2026, 9, 5, 10, 0)); // Monday
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'ADD DAILY TASK' }));
    const dialog = screen.getByRole('dialog', { name: 'NEW DAILY TASK' });
    expect(within(dialog).getByText('STARTS TODAY')).toBeInTheDocument();
    expect(within(dialog).queryByRole('spinbutton')).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'NAME' }), { target: { value: 'Meditate' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '[ SAVE ]' }));
    const card = screen.getByRole('article', { name: 'Meditate' });
    expect(within(card).getByRole('button', { name: '[ MARK DONE ]' })).toBeInTheDocument();
  });

  it('edits a task name, image and description but not its target', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Coding' }));
    const dialog = screen.getByRole('dialog', { name: 'EDIT TASK' });
    expect(within(dialog).getByRole('textbox', { name: 'NAME' })).toHaveValue('Coding');
    expect(within(dialog).queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(within(dialog).getByText('5 PER WEEK')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'NAME' }), { target: { value: 'Deep work' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '[ SAVE ]' }));
    expect(screen.getByRole('article', { name: 'Deep work' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Coding' })).not.toBeInTheDocument();
  });

  it('removes a started task at the end of the week in two steps, and can undo it', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Coding' }));
    let dialog = screen.getByRole('dialog', { name: 'EDIT TASK' });
    fireEvent.click(within(dialog).getByRole('button', { name: '[ REMOVE ]' }));
    expect(within(dialog).getByText('STAYS UNTIL SUNDAY NIGHT AND IS SCORED AS USUAL')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '[ CONFIRM REMOVE ]' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Coding' })).getByText(/RETIRES SUNDAY/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Coding' }));
    dialog = screen.getByRole('dialog', { name: 'EDIT TASK' });
    fireEvent.click(within(dialog).getByRole('button', { name: '[ UNDO REMOVE ]' }));
    expect(within(screen.getByRole('article', { name: 'Coding' })).queryByText(/RETIRES SUNDAY/)).not.toBeInTheDocument();
  });

  it('removes a not-yet-started task immediately', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'ADD DAILY TASK' }));
    let dialog = screen.getByRole('dialog', { name: 'NEW DAILY TASK' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'NAME' }), { target: { value: 'Meditate' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '[ SAVE ]' }));

    fireEvent.click(screen.getByRole('button', { name: 'Edit Meditate' }));
    dialog = screen.getByRole('dialog', { name: 'EDIT TASK' });
    fireEvent.click(within(dialog).getByRole('button', { name: '[ REMOVE ]' }));
    expect(within(dialog).getByText('REMOVED NOW')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '[ CONFIRM REMOVE ]' }));
    expect(screen.queryByRole('article', { name: 'Meditate' })).not.toBeInTheDocument();
  });

  it('shows every section with its add card even when it has no tasks', () => {
    const tasks = seedTasks('2026-09-28').filter((t) => t.cadence.kind === 'daily');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...freshState('2026-09-30'), tasks }));
    render(<App />);
    const weekly = screen.getByRole('region', { name: 'WEEKLY' });
    expect(within(weekly).queryAllByRole('article')).toHaveLength(0);
    expect(within(weekly).getByRole('button', { name: 'ADD WEEKLY TASK' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ADD NO-LIMIT TASK' })).toBeInTheDocument();
  });
});
