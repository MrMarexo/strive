import { useCallback, useEffect, useReducer } from 'react';
import { complete, rename, undo } from '../domain/actions';
import { toKey, type DateKey } from '../domain/dates';
import { settle } from '../domain/settle';
import type { TaskId } from '../domain/tasks';
import type { AppState } from '../domain/types';
import { STORAGE_KEY, load, save } from '../storage/persist';

type Action =
  | { type: 'settle'; today: DateKey }
  | { type: 'replace'; state: AppState; today: DateKey }
  | { type: 'complete' | 'undo'; id: TaskId; today: DateKey }
  | { type: 'rename'; name: string; today: DateKey };

function reducer(state: AppState, action: Action): AppState {
  const settled = settle(state, action.today);
  switch (action.type) {
    case 'settle':
      return settled;
    case 'replace':
      return settle(action.state, action.today);
    case 'complete':
      return complete(settled, action.id, action.today);
    case 'undo':
      return undo(settled, action.id, action.today);
    case 'rename':
      return rename(settled, action.name);
  }
}

const currentKey = () => toKey(new Date());

function init(): AppState {
  const today = currentKey();
  return settle(load(today), today);
}

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  useEffect(() => {
    save(state);
  }, [state]);

  useEffect(() => {
    const tick = () => dispatch({ type: 'settle', today: currentKey() });
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    // Another tab saved: adopt its state so our next save doesn't overwrite it.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const today = currentKey();
      dispatch({ type: 'replace', state: load(today), today });
    };
    // Fire right after local midnight so the new day shows immediately; the
    // interval still covers sleep/wake and clock changes.
    let midnight: ReturnType<typeof setTimeout>;
    const scheduleMidnight = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      midnight = setTimeout(() => {
        tick();
        scheduleMidnight();
      }, next.getTime() - now.getTime() + 100);
    };
    scheduleMidnight();
    const interval = setInterval(tick, 60_000);
    window.addEventListener('focus', tick);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      clearTimeout(midnight);
      window.removeEventListener('focus', tick);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const completeTask = useCallback((id: TaskId) => dispatch({ type: 'complete', id, today: currentKey() }), []);
  const undoTask = useCallback((id: TaskId) => dispatch({ type: 'undo', id, today: currentKey() }), []);

  const renamePlayer = useCallback((name: string) => dispatch({ type: 'rename', name, today: currentKey() }), []);

  return { state, today: currentKey(), complete: completeTask, undo: undoTask, rename: renamePlayer };
}
