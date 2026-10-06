import { IMAGE_KEYS } from './imageKeys';
import type { AppState } from './types';

export interface CustomImage {
  key: string; // 'c-' + 8 hex chars
  map: string[]; // 10 rows of 10 '#'/'.'
}

export const MAX_CUSTOM_IMAGES = 100;
export const CUSTOM_KEY_RE = /^c-[0-9a-f]{8}$/;
const ROW_RE = /^[#.]{10}$/;

export function isValidMap(map: unknown): map is string[] {
  return (
    Array.isArray(map) &&
    map.length === 10 &&
    map.every((row) => typeof row === 'string' && ROW_RE.test(row)) &&
    map.some((row: string) => row.includes('#'))
  );
}

export function isImageKey(state: Pick<AppState, 'customImages'>, key: string): boolean {
  return IMAGE_KEYS.includes(key) || state.customImages.some((image) => image.key === key);
}

export function addImage(state: AppState, map: string[], key: string): AppState {
  if (!isValidMap(map) || !CUSTOM_KEY_RE.test(key) || isImageKey(state, key)) return state;
  if (state.customImages.length >= MAX_CUSTOM_IMAGES) return state;
  return { ...state, customImages: [...state.customImages, { key, map: [...map] }] };
}

// Shared library: every task using the image changes with it.
export function updateImage(state: AppState, key: string, map: string[]): AppState {
  if (!isValidMap(map) || !state.customImages.some((image) => image.key === key)) return state;
  return {
    ...state,
    customImages: state.customImages.map((image) => (image.key === key ? { key, map: [...map] } : image)),
  };
}

export function imageUsers(state: AppState, key: string): string[] {
  return state.tasks.filter((task) => task.image === key).map((task) => task.name);
}

// Blocked while any task (active, pending or retiring) uses it: a task pointing at a
// missing image would make saved data invalid.
export function deleteImage(state: AppState, key: string): AppState {
  if (!state.customImages.some((image) => image.key === key) || imageUsers(state, key).length > 0) return state;
  return { ...state, customImages: state.customImages.filter((image) => image.key !== key) };
}
