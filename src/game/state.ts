import {
  SHIP_SPECS,
  type Board,
  type Orientation,
  type Phase,
  type Player,
  type ShipId,
} from './types';
import {
  cellName,
  createEmptyBoard,
  describeShip,
  fireAt,
  placeShip,
  randomBoard,
  removeShip,
} from './board';
import { chooseShot, createAiState, updateAiAfterShot, type AiState } from './ai';

export interface GameState {
  phase: Phase;
  playerBoard: Board;
  aiBoard: Board;
  turn: Player;
  ai: AiState;
  winner: Player | null;
  selectedShip: ShipId | null;
  orientation: Orientation;
  log: string[];
}

export type Action =
  | { type: 'selectShip'; id: ShipId }
  | { type: 'setOrientation'; orientation: Orientation }
  | { type: 'toggleOrientation' }
  | { type: 'placeShip'; index: number }
  | { type: 'removeShip'; id: ShipId }
  | { type: 'randomize' }
  | { type: 'resetPlacement' }
  | { type: 'start' }
  | { type: 'playerShot'; index: number }
  | { type: 'aiShot' }
  | { type: 'newGame' };

const firstUnplaced = (board: Board): ShipId | null =>
  SHIP_SPECS.find((spec) => !board.ships.some((ship) => ship.id === spec.id))?.id ?? null;

export const allShipsPlaced = (board: Board): boolean => board.ships.length === SHIP_SPECS.length;

export const createInitialState = (): GameState => ({
  phase: 'placement',
  playerBoard: createEmptyBoard(),
  aiBoard: createEmptyBoard(),
  turn: 'human',
  ai: createAiState(),
  winner: null,
  selectedShip: SHIP_SPECS[0].id,
  orientation: 'horizontal',
  log: [],
});

const pushLog = (log: string[], entry: string): string[] => [entry, ...log].slice(0, 40);

export const reducer = (state: GameState, action: Action): GameState => {
  switch (action.type) {
    case 'selectShip':
      return state.phase === 'placement' ? { ...state, selectedShip: action.id } : state;

    case 'setOrientation':
      return state.phase === 'placement' ? { ...state, orientation: action.orientation } : state;

    case 'toggleOrientation':
      return state.phase === 'placement'
        ? {
            ...state,
            orientation: state.orientation === 'horizontal' ? 'vertical' : 'horizontal',
          }
        : state;

    case 'placeShip': {
      if (state.phase !== 'placement' || !state.selectedShip) return state;
      const spec = SHIP_SPECS.find((s) => s.id === state.selectedShip);
      if (!spec) return state;
      const board = placeShip(state.playerBoard, spec, action.index, state.orientation);
      if (!board) return state;
      return { ...state, playerBoard: board, selectedShip: firstUnplaced(board) };
    }

    case 'removeShip': {
      if (state.phase !== 'placement') return state;
      const board = removeShip(state.playerBoard, action.id);
      return { ...state, playerBoard: board, selectedShip: action.id };
    }

    case 'randomize': {
      if (state.phase !== 'placement') return state;
      const board = randomBoard();
      return { ...state, playerBoard: board, selectedShip: null };
    }

    case 'resetPlacement':
      if (state.phase !== 'placement') return state;
      return {
        ...state,
        playerBoard: createEmptyBoard(),
        selectedShip: SHIP_SPECS[0].id,
      };

    case 'start': {
      if (state.phase !== 'placement' || !allShipsPlaced(state.playerBoard)) return state;
      return {
        ...state,
        phase: 'playing',
        aiBoard: randomBoard(),
        turn: 'human',
        ai: createAiState(),
        winner: null,
        log: ['Battle stations! Fire at the enemy fleet.'],
      };
    }

    case 'playerShot': {
      if (state.phase !== 'playing' || state.turn !== 'human') return state;
      const { board, hit, sunk, allSunk } = fireAt(state.aiBoard, action.index);
      if (board === state.aiBoard) return state; // repeat shot
      const entry = sunk
        ? `You sank the enemy ${describeShip(sunk)}!`
        : hit
          ? `You hit an enemy ship at ${cellName(action.index)}.`
          : `You missed at ${cellName(action.index)}.`;
      const log = pushLog(state.log, entry);
      if (allSunk) {
        return {
          ...state,
          aiBoard: board,
          phase: 'gameover',
          winner: 'human',
          log: pushLog(log, 'You destroyed the entire enemy fleet. Victory!'),
        };
      }
      return { ...state, aiBoard: board, turn: 'ai', log };
    }

    case 'aiShot': {
      if (state.phase !== 'playing' || state.turn !== 'ai') return state;
      const { index, ai } = chooseShot(state.playerBoard, state.ai);
      const { board, hit, sunk, allSunk } = fireAt(state.playerBoard, index);
      const nextAi = updateAiAfterShot(ai, board, index, hit, sunk !== null);
      const entry = sunk
        ? `The enemy sank your ${describeShip(sunk)}!`
        : hit
          ? `The enemy hit your ship at ${cellName(index)}.`
          : `The enemy missed at ${cellName(index)}.`;
      const log = pushLog(state.log, entry);
      if (allSunk) {
        return {
          ...state,
          playerBoard: board,
          ai: nextAi,
          phase: 'gameover',
          winner: 'ai',
          log: pushLog(log, 'Your fleet has been destroyed. Defeat.'),
        };
      }
      return {
        ...state,
        playerBoard: board,
        ai: nextAi,
        turn: 'human',
        log,
      };
    }

    case 'newGame':
      return createInitialState();

    default:
      return state;
  }
};
