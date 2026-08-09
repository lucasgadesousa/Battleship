export const BOARD_SIZE = 10;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

export type Orientation = 'horizontal' | 'vertical';

export type ShipId = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';

export interface ShipSpec {
  id: ShipId;
  name: string;
  size: number;
}

export const SHIP_SPECS: readonly ShipSpec[] = [
  { id: 'carrier', name: 'Carrier', size: 5 },
  { id: 'battleship', name: 'Battleship', size: 4 },
  { id: 'cruiser', name: 'Cruiser', size: 3 },
  { id: 'submarine', name: 'Submarine', size: 3 },
  { id: 'destroyer', name: 'Destroyer', size: 2 },
];

export interface Ship {
  id: ShipId;
  name: string;
  size: number;
  cells: number[];
  hits: number[];
}

/** A fleet plus the shots that have been fired at it. */
export interface Board {
  ships: Ship[];
  hits: number[];
  misses: number[];
}

export type Player = 'human' | 'ai';

export type Phase = 'placement' | 'playing' | 'gameover';

export interface ShotResult {
  board: Board;
  hit: boolean;
  sunk: Ship | null;
  allSunk: boolean;
}
