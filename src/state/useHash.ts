import { useEffect, useState } from 'react';

export type Route = { page: 'home' } | { page: 'rank'; slug: string };

export function parseRoute(hash: string): Route {
  const match = /^#\/ranks\/([^/]+)$/.exec(hash);
  return match ? { page: 'rank', slug: match[1] } : { page: 'home' };
}

export function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

// replace swaps the current history entry, so stepping through ranks doesn't
// make the browser's Back button walk through every rank viewed.
export function navigate(hash: string, { replace = false }: { replace?: boolean } = {}): void {
  if (replace) window.location.replace(hash);
  else window.location.hash = hash;
}
