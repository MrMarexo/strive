import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Header } from './Header';

describe('Header', () => {
  it('shows rank, points, progress and pending', () => {
    render(<Header points={80} pending={4} weekStart="2026-09-28" />);
    expect(screen.getByRole('heading', { name: 'KNIGHT' })).toBeInTheDocument();
    expect(screen.getByText('80 PTS')).toBeInTheDocument();
    expect(screen.getByText('25 TO RANGER')).toBeInTheDocument();
    expect(screen.getByText('▓▓▓')).toBeInTheDocument();
    expect(screen.getByText(/TODAY: \+4 PENDING · WEEK OF SEP 28/)).toBeInTheDocument();
  });

  it('shows MAX RANK at the top', () => {
    render(<Header points={600} pending={0} weekStart="2026-09-28" />);
    expect(screen.getByRole('heading', { name: 'LEGEND OF THE REALM' })).toBeInTheDocument();
    expect(screen.getByText('MAX RANK')).toBeInTheDocument();
  });
});
