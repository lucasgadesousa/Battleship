import {
  BOARD_SIZE,
  CELL_COUNT,
  SHIP_SPECS,
  type Board,
  type Orientation,
  type Ship,
  type ShipSpec,
  type ShotResult,
} from './types';

export const toIndex = (row: number, col: number): number => row * BOARD_SIZE + col;
export const toCoords = (index: number): { row: number; col: number } => ({
  row: Math.floor(index / BOARD_SIZE),
  col: index % BOARD_SIZE,
});

export const createEmptyBoard = (): Board => ({ ships: [], hits: [], misses: [] });

/**
 * Cells a ship would occupy, or null when it would run off the edge of the
 * board. Horizontal ships must stay inside a single row.
 */
export const shipCells = (
  start: number,
  size: number,
  orientation: Orientation,
): number[] | null => {
  if (start < 0 || start >= CELL_COUNT) return null;
  const { row, col } = toCoords(start);
  if (orientation === 'horizontal') {
    if (col + size > BOARD_SIZE) return null;
    return Array.from({ length: size }, (_, i) => toIndex(row, col + i));
  }
  if (row + size > BOARD_SIZE) return null;
  return Array.from({ length: size }, (_, i) => toIndex(row + i, col));
};

export const occupiedCells = (board: Board): Set<number> =>
  new Set(board.ships.flatMap((ship) => ship.cells));

export const canPlace = (
  board: Board,
  start: number,
  size: number,
  orientation: Orientation,
): boolean => {
  const cells = shipCells(start, size, orientation);
  if (!cells) return false;
  const taken = occupiedCells(board);
  return cells.every((cell) => !taken.has(cell));
};

export const placeShip = (
  board: Board,
  spec: ShipSpec,
  start: number,
  orientation: Orientation,
): Board | null => {
  if (board.ships.some((ship) => ship.id === spec.id)) return null;
  const cells = shipCells(start, spec.size, orientation);
  if (!cells || !canPlace(board, start, spec.size, orientation)) return null;
  const ship: Ship = { id: spec.id, name: spec.name, size: spec.size, cells, hits: [] };
  return { ...board, ships: [...board.ships, ship] };
};

export const removeShip = (board: Board, id: Ship['id']): Board => ({
  ...board,
  ships: board.ships.filter((ship) => ship.id !== id),
});

export const randomBoard = (
  random: () => number = Math.random,
  specs: readonly ShipSpec[] = SHIP_SPECS,
): Board => {
  let board = createEmptyBoard();
  for (const spec of specs) {
    const options: Array<{ start: number; orientation: Orientation }> = [];
    for (let start = 0; start < CELL_COUNT; start += 1) {
      for (const orientation of ['horizontal', 'vertical'] as const) {
        if (canPlace(board, start, spec.size, orientation)) options.push({ start, orientation });
      }
    }
    const choice = options[Math.floor(random() * options.length)];
    const next = placeShip(board, spec, choice.start, choice.orientation);
    if (!next) throw new Error(`Unable to place ${spec.name}`);
    board = next;
  }
  return board;
};

export const isShipSunk = (ship: Ship): boolean => ship.hits.length === ship.size;

export const allShipsSunk = (board: Board): boolean =>
  board.ships.length > 0 && board.ships.every(isShipSunk);

export const alreadyShot = (board: Board, index: number): boolean =>
  board.hits.includes(index) || board.misses.includes(index);

/** Applies a shot at `index`; returns the new board plus what happened. */
export const fireAt = (board: Board, index: number): ShotResult => {
  if (alreadyShot(board, index)) {
    return { board, hit: board.hits.includes(index), sunk: null, allSunk: allShipsSunk(board) };
  }
  const target = board.ships.find((ship) => ship.cells.includes(index));
  if (!target) {
    const next: Board = { ...board, misses: [...board.misses, index] };
    return { board: next, hit: false, sunk: null, allSunk: allShipsSunk(next) };
  }
  const updatedShip: Ship = { ...target, hits: [...target.hits, index] };
  const next: Board = {
    ...board,
    ships: board.ships.map((ship) => (ship.id === target.id ? updatedShip : ship)),
    hits: [...board.hits, index],
  };
  return {
    board: next,
    hit: true,
    sunk: isShipSunk(updatedShip) ? updatedShip : null,
    allSunk: allShipsSunk(next),
  };
};
