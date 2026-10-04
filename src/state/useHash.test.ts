import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { navigate, parseRoute, useHash } from './useHash';

describe('parseRoute', () => {
  it.each(['', '#', '#/', '#/nope', '#/ranks/', '#/ranks'])('treats %j as home', (hash) => {
    expect(parseRoute(hash)).toEqual({ page: 'home' });
  });

  it('reads a rank slug', () => {
    expect(parseRoute('#/ranks/man-at-arms')).toEqual({ page: 'rank', slug: 'man-at-arms' });
  });
});

describe('useHash', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('follows hash changes', () => {
    const { result } = renderHook(() => useHash());
    expect(result.current).toBe('');
    act(() => {
      navigate('#/ranks/king');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current).toBe('#/ranks/king');
  });

  it('can replace the current history entry instead of adding one', () => {
    navigate('#/ranks/king');
    const length = window.history.length;
    navigate('#/ranks/lord', { replace: true });
    expect(window.location.hash).toBe('#/ranks/lord');
    expect(window.history.length).toBe(length);
  });
});
