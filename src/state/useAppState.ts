import { useCallback, useEffect, useReducer } from 'react';
import {
  addTask, complete, editTask, removeTask, rename, undo, undoRemove,
  type NewTaskInput, type TaskEdit,
} from '../domain/actions';
import { toKey, type DateKey } from '../domain/dates';
import { addImage, deleteImage, updateImage } from '../domain/images';
import { settle } from '../domain/settle';
import type { TaskId } from '../domain/tasks';
import type { AppState } from '../domain/types';
import { STORAGE_KEY, load, loadStored, save } from '../storage/persist';

type Action =
  | { type: 'settle'; today: DateKey }
  | { type: 'replace'; state: AppState; today: DateKey }
  | { type: 'complete' | 'undo'; id: TaskId; today: DateKey }
  | { type: 'rename'; name: string; today: DateKey }
  | { type: 'addTask'; input: NewTaskInput; id: TaskId; today: DateKey }
  | { type: 'editTask'; id: TaskId; edit: TaskEdit; today: DateKey }
  | { type: 'removeTask' | 'undoRemove'; id: TaskId; today: DateKey }
  | { type: 'addImage'; map: string[]; key: string; today: DateKey }
  | { type: 'updateImage'; key: string; map: string[]; today: DateKey }
  | { type: 'deleteImage'; key: string; today: DateKey };

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
    case 'addTask':
      return addTask(settled, action.input, action.today, action.id);
    case 'editTask':
      return editTask(settled, action.id, action.edit);
    case 'removeTask':
      return removeTask(settled, action.id, action.today);
    case 'undoRemove':
      return undoRemove(settled, action.id);
    case 'addImage':
      return addImage(settled, action.map, action.key);
    case 'updateImage':
      return updateImage(settled, action.key, action.map);
    case 'deleteImage':
      return deleteImage(settled, action.key);
  }
}

const currentKey = () => toKey(new Date());

// Ids are generated outside the reducer so StrictMode's double-run sees the same one.
// getRandomValues (unlike randomUUID) also works on plain-HTTP pages, e.g. the dev server opened from a phone.
const randomHex = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('');
const newTaskId = () => `t-${randomHex()}`;
const newImageKey = () => `c-${randomHex()}`;

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
      // Ignore data this version can't read (e.g. from a tab running older code) rather than resetting.
      const next = loadStored(today);
      if (next) dispatch({ type: 'replace', state: next, today });
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

  const addNewTask = useCallback(
    (input: NewTaskInput) => dispatch({ type: 'addTask', input, id: newTaskId(), today: currentKey() }),
    [],
  );
  const editExistingTask = useCallback(
    (id: TaskId, edit: TaskEdit) => dispatch({ type: 'editTask', id, edit, today: currentKey() }),
    [],
  );
  const removeExistingTask = useCallback((id: TaskId) => dispatch({ type: 'removeTask', id, today: currentKey() }), []);
  const undoTaskRemoval = useCallback((id: TaskId) => dispatch({ type: 'undoRemove', id, today: currentKey() }), []);

  const addNewImage = useCallback((map: string[]) => {
    const key = newImageKey();
    dispatch({ type: 'addImage', map, key, today: currentKey() });
    return key;
  }, []);
  const updateExistingImage = useCallback(
    (key: string, map: string[]) => dispatch({ type: 'updateImage', key, map, today: currentKey() }),
    [],
  );
  const deleteExistingImage = useCallback((key: string) => dispatch({ type: 'deleteImage', key, today: currentKey() }), []);

  return {
    state,
    today: currentKey(),
    complete: completeTask,
    undo: undoTask,
    rename: renamePlayer,
    addTask: addNewTask,
    editTask: editExistingTask,
    removeTask: removeExistingTask,
    undoRemove: undoTaskRemoval,
    addImage: addNewImage,
    updateImage: updateExistingImage,
    deleteImage: deleteExistingImage,
  };
}
