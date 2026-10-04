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

export function navigate(hash: string): void {
  window.location.hash = hash;
}
