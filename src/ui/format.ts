export function barCells(progress: number, cells = 20): { filled: number; empty: number } {
  const filled = Math.min(cells, Math.max(0, Math.floor(progress * cells)));
  return { filled, empty: cells - filled };
}

export function cadenceLabel(remaining: number): string {
  return remaining === 0 ? 'TARGET MET' : `${remaining} LEFT THIS WEEK`;
}
