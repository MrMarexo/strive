import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RankPage } from './RankPage';
import { RANKS } from '../domain/ranks';
import type { AppState } from '../domain/types';

function state(over: Partial<AppState> = {}): AppState {
  return {
    version: 1, points: 0, lastSettledDate: '2026-10-04', completions: {}, graceWeek: '2026-09-28',
    weekNumber: 1, playerName: 'no_name', rankDays: {}, tasks: [], customImages: [], ...over,
  };
}

const rank = (title: string) => RANKS.find((r) => r.title === title)!;

function renderPage(title: string, over: Partial<AppState> = {}) {
  const onNavigate = vi.fn();
  const view = render(<RankPage state={state(over)} rank={rank(title)} onNavigate={onNavigate} />);
  return { onNavigate, ...view };
}

describe('RankPage', () => {
  it('shows the current rank with lore, days and a current tag', () => {
    renderPage('Beggar');
    expect(screen.getByRole('region', { name: 'Beggar rank' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Beggar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'BEGGAR' })).toBeInTheDocument();
    expect(screen.getByText('RANK 1/15')).toBeInTheDocument();
    expect(screen.getByText('0 PTS+')).toBeInTheDocument();
    expect(screen.getByText(/tavern of Good Intentions/)).toBeInTheDocument();
    expect(screen.getByText('DAY AS BEGGAR: 1')).toBeInTheDocument();
    expect(screen.getByText('* CURRENT RANK *')).toBeInTheDocument();
  });

  it('pluralises days and omits the current tag for past ranks', () => {
    renderPage('Peasant', { points: 80, rankDays: { Peasant: 4 } });
    expect(screen.getByText('DAYS AS PEASANT: 4')).toBeInTheDocument();
    expect(screen.queryByText('* CURRENT RANK *')).not.toBeInTheDocument();
  });

  it('hides a locked rank behind a question mark', () => {
    renderPage('Knight');
    expect(screen.getByRole('img', { name: 'Locked rank' })).toBeInTheDocument();
    expect(screen.getByText('REACH 75 PTS TO UNLOCK')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Locked rank' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '???' })).toBeInTheDocument();
    expect(screen.queryByText(/KNIGHT/)).not.toBeInTheDocument();
    expect(screen.queryByText('75 PTS+')).not.toBeInTheDocument();
    expect(screen.queryByText(/whisper your name/)).not.toBeInTheDocument();
    expect(screen.queryByText(/AS KNIGHT/)).not.toBeInTheDocument();
  });

  it('steps between ranks with the arrow buttons, disabled at the ends', () => {
    const { onNavigate, unmount } = renderPage('Beggar');
    expect(screen.getByRole('button', { name: 'Previous rank' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next rank' }));
    expect(onNavigate).toHaveBeenCalledWith('#/ranks/peasant', { replace: true });
    unmount();

    renderPage('Legend of the Realm', { points: 600 });
    expect(screen.getByRole('button', { name: 'Next rank' })).toBeDisabled();
  });

  it('supports arrow keys and Escape, and Back goes home', () => {
    const { onNavigate } = renderPage('Peasant', { points: 5 });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onNavigate).toHaveBeenLastCalledWith('#/ranks/beggar', { replace: true });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onNavigate).toHaveBeenLastCalledWith('#/ranks/stable-hand', { replace: true });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onNavigate).toHaveBeenLastCalledWith('#/');
    fireEvent.click(screen.getByRole('button', { name: '[ < BACK ]' }));
    expect(onNavigate).toHaveBeenLastCalledWith('#/');
  });

  it('stops listening to keys once it is gone', () => {
    const { onNavigate, unmount } = renderPage('Peasant', { points: 5 });
    unmount();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
