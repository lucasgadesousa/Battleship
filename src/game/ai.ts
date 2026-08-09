import { BOARD_SIZE, CELL_COUNT, type Board } from './types';
import { alreadyShot, toCoords, toIndex } from './board';

export interface AiState {
  /** Cells queued for follow-up after a hit (hunt/target strategy). */
  targets: number[];
}

export const createAiState = (): AiState => ({ targets: [] });

const neighbours = (index: number): number[] => {
  const { row, col } = toCoords(index);
  const result: number[] = [];
  if (row > 0) result.push(toIndex(row - 1, col));
  if (row < BOARD_SIZE - 1) result.push(toIndex(row + 1, col));
  if (col > 0) result.push(toIndex(row, col - 1));
  if (col < BOARD_SIZE - 1) result.push(toIndex(row, col + 1));
  return result;
};

/** Picks the AI's next shot: queued targets first, then a parity-based hunt. */
export const chooseShot = (
  board: Board,
  ai: AiState,
  random: () => number = Math.random,
): { index: number; ai: AiState } => {
  const queue = ai.targets.filter((cell) => !alreadyShot(board, cell));
  if (queue.length > 0) {
    const [index, ...rest] = queue;
    return { index, ai: { targets: rest } };
  }

  const available: number[] = [];
  for (let i = 0; i < CELL_COUNT; i += 1) {
    if (!alreadyShot(board, i)) available.push(i);
  }
  if (available.length === 0) throw new Error('No cells left to shoot');
  const parity = available.filter((cell) => {
    const c = toCoords(cell);
    return (c.row + c.col) % 2 === 0;
  });
  const pool = parity.length > 0 ? parity : available;
  return { index: pool[Math.floor(random() * pool.length)], ai: { targets: [] } };
};

/** Queues neighbours of a hit; clears the queue once the ship is sunk. */
export const updateAiAfterShot = (
  ai: AiState,
  board: Board,
  index: number,
  hit: boolean,
  sunk: boolean,
): AiState => {
  if (sunk) return { targets: [] };
  if (!hit) return ai;
  const added = neighbours(index).filter(
    (cell) => !alreadyShot(board, cell) && !ai.targets.includes(cell),
  );
  return { targets: [...ai.targets, ...added] };
};
