import { describe, expect, it } from 'vitest';
import {
  allShipsSunk,
  canPlace,
  cellName,
  createEmptyBoard,
  describeShip,
  fireAt,
  isBoardValid,
  placeShip,
  randomBoard,
  shipCells,
  toIndex,
} from './board';
import { chooseShot, createAiState, updateAiAfterShot } from './ai';
import { allShipsPlaced, createInitialState, reducer } from './state';
import { SHIP_SPECS, type Board } from './types';

const spec = (id: string) => SHIP_SPECS.find((s) => s.id === id)!;

describe('shipCells', () => {
  it('does not wrap horizontally across rows', () => {
    expect(shipCells(toIndex(0, 7), 5, 'horizontal')).toBeNull();
    expect(shipCells(toIndex(0, 5), 5, 'horizontal')).toEqual([5, 6, 7, 8, 9]);
  });

  it('rejects vertical ships past the bottom edge', () => {
    expect(shipCells(toIndex(7, 0), 5, 'vertical')).toBeNull();
    expect(shipCells(toIndex(5, 0), 5, 'vertical')).toEqual([50, 60, 70, 80, 90]);
  });
});

describe('placement', () => {
  it('rejects overlapping ships', () => {
    const board = placeShip(createEmptyBoard(), spec('carrier'), 0, 'horizontal')!;
    expect(canPlace(board, toIndex(0, 4), 4, 'horizontal')).toBe(false);
    expect(placeShip(board, spec('battleship'), toIndex(0, 4), 'horizontal')).toBeNull();
    expect(placeShip(board, spec('battleship'), toIndex(1, 0), 'horizontal')).not.toBeNull();
  });

  it('rejects placing the same ship twice', () => {
    const board = placeShip(createEmptyBoard(), spec('carrier'), 0, 'horizontal')!;
    expect(placeShip(board, spec('carrier'), toIndex(5, 0), 'horizontal')).toBeNull();
  });

  it('random boards always contain the full non-overlapping fleet', () => {
    for (let i = 0; i < 200; i += 1) {
      const board = randomBoard();
      const cells = board.ships.flatMap((s) => s.cells);
      expect(board.ships).toHaveLength(SHIP_SPECS.length);
      expect(new Set(cells).size).toBe(cells.length);
      expect(cells.every((c) => c >= 0 && c < 100)).toBe(true);
      expect(isBoardValid(board)).toBe(true);
    }
  });

  it('never accepts a placement that overlaps or leaves the grid', () => {
    // Exhaustive: every ship, every start cell, both orientations.
    const base = placeShip(createEmptyBoard(), spec('cruiser'), toIndex(4, 4), 'horizontal')!;
    for (const s of SHIP_SPECS) {
      if (s.id === 'cruiser') continue;
      for (let start = 0; start < 100; start += 1) {
        for (const orientation of ['horizontal', 'vertical'] as const) {
          const next = placeShip(base, s, start, orientation);
          if (!next) continue;
          expect(isBoardValid(next)).toBe(true);
        }
      }
    }
  });

  it('the reducer keeps the player board valid whatever the player clicks', () => {
    let state = createInitialState();
    for (let i = 0; i < 400; i += 1) {
      const s = SHIP_SPECS[i % SHIP_SPECS.length];
      state = reducer(state, { type: 'selectShip', id: s.id });
      if (i % 7 === 0) state = reducer(state, { type: 'toggleOrientation' });
      state = reducer(state, { type: 'placeShip', index: Math.floor(Math.random() * 100) });
      expect(isBoardValid(state.playerBoard)).toBe(true);
      expect(state.playerBoard.ships.length).toBeLessThanOrEqual(SHIP_SPECS.length);
    }
  });
});

describe('fireAt', () => {
  const board = placeShip(createEmptyBoard(), spec('destroyer'), 0, 'horizontal')!;

  it('records hits, misses and sinks', () => {
    const first = fireAt(board, 0);
    expect(first.hit).toBe(true);
    expect(first.sunk).toBeNull();
    const second = fireAt(first.board, 1);
    expect(second.sunk?.id).toBe('destroyer');
    expect(second.allSunk).toBe(true);
    const miss = fireAt(board, 50);
    expect(miss.hit).toBe(false);
    expect(miss.board.misses).toEqual([50]);
  });

  it('ignores repeat shots without mutating the board', () => {
    const once = fireAt(board, 0).board;
    const twice = fireAt(once, 0);
    expect(twice.board).toBe(once);
    expect(twice.board.hits).toEqual([0]);
  });

  it('treats an empty board as not fully sunk', () => {
    expect(allShipsSunk(createEmptyBoard())).toBe(false);
  });
});

describe('ai', () => {
  it('never repeats a shot over a full game', () => {
    let board: Board = randomBoard();
    let ai = createAiState();
    const seen = new Set<number>();
    for (let i = 0; i < 100; i += 1) {
      const shot = chooseShot(board, ai);
      expect(seen.has(shot.index)).toBe(false);
      seen.add(shot.index);
      const result = fireAt(board, shot.index);
      board = result.board;
      ai = updateAiAfterShot(shot.ai, board, shot.index, result.hit, result.sunk !== null);
    }
    expect(seen.size).toBe(100);
  });

  it('targets neighbours after a hit', () => {
    const board = placeShip(createEmptyBoard(), spec('cruiser'), toIndex(4, 4), 'horizontal')!;
    const result = fireAt(board, toIndex(4, 4));
    const ai = updateAiAfterShot(createAiState(), result.board, toIndex(4, 4), true, false);
    expect(ai.targets).toContain(toIndex(4, 5));
    const next = chooseShot(result.board, ai);
    expect(ai.targets).toContain(next.index);
  });

  it('clears the target queue once a ship is sunk', () => {
    const ai = updateAiAfterShot({ targets: [1, 2] }, createEmptyBoard(), 0, true, true);
    expect(ai.targets).toEqual([]);
  });
});

describe('ship descriptions', () => {
  it('names cells in column-row notation', () => {
    expect(cellName(0)).toBe('A1');
    expect(cellName(toIndex(4, 2))).toBe('C5');
    expect(cellName(99)).toBe('J10');
  });

  it('describes a ship by size, span and orientation', () => {
    const board = placeShip(createEmptyBoard(), spec('cruiser'), toIndex(4, 2), 'horizontal')!;
    expect(describeShip(board.ships[0])).toBe('Cruiser (3) — C5–E5, horizontal');
    const vertical = placeShip(createEmptyBoard(), spec('destroyer'), toIndex(0, 0), 'vertical')!;
    expect(describeShip(vertical.ships[0])).toBe('Destroyer (2) — A1–A2, vertical');
  });
});

describe('reducer', () => {
  const placeAll = () => {
    let state = createInitialState();
    SHIP_SPECS.forEach((s, row) => {
      state = reducer(state, { type: 'selectShip', id: s.id });
      state = reducer(state, { type: 'placeShip', index: toIndex(row * 2, 0) });
    });
    return state;
  };

  it('will not start until the whole fleet is placed', () => {
    const state = createInitialState();
    expect(reducer(state, { type: 'start' }).phase).toBe('placement');
    const ready = placeAll();
    const started = reducer(ready, { type: 'start' });
    expect(started.phase).toBe('playing');
    expect(started.aiBoard.ships).toHaveLength(SHIP_SPECS.length);
  });

  it('ignores player shots out of turn and repeat shots', () => {
    let state = reducer(placeAll(), { type: 'start' });
    state = reducer(state, { type: 'playerShot', index: 0 });
    expect(state.turn).toBe('ai');
    const unchanged = reducer(state, { type: 'playerShot', index: 5 });
    expect(unchanged).toBe(state);
    state = reducer(state, { type: 'aiShot' });
    expect(state.turn).toBe('human');
    const repeat = reducer(state, { type: 'playerShot', index: 0 });
    expect(repeat).toBe(state);
  });

  it('declares the human winner when the enemy fleet is destroyed', () => {
    let state = reducer(placeAll(), { type: 'start' });
    const enemyCells = state.aiBoard.ships.flatMap((s) => s.cells);
    for (const cell of enemyCells) {
      state = { ...state, turn: 'human', phase: state.phase };
      if (state.phase === 'gameover') break;
      state = reducer(state, { type: 'playerShot', index: cell });
    }
    expect(state.phase).toBe('gameover');
    expect(state.winner).toBe('human');
  });

  it('logs the full description of a destroyed ship', () => {
    let state = reducer(placeAll(), { type: 'start' });
    const target = state.aiBoard.ships.find((s) => s.id === 'destroyer')!;
    for (const cell of target.cells) {
      state = reducer({ ...state, turn: 'human' }, { type: 'playerShot', index: cell });
    }
    expect(state.log[0]).toBe(`You sank the enemy ${describeShip(target)}!`);
    expect(state.log[0]).toContain('Destroyer (2)');
  });

  it('auto-selects the next unplaced ship and keeps the selection on a rejected click', () => {
    let state = createInitialState();
    expect(state.selectedShip).toBe(SHIP_SPECS[0].id);
    state = reducer(state, { type: 'placeShip', index: toIndex(0, 0) });
    expect(state.selectedShip).toBe(SHIP_SPECS[1].id);
    // Overlaps the carrier: the board and the selection must be untouched.
    const rejected = reducer(state, { type: 'placeShip', index: toIndex(0, 0) });
    expect(rejected).toBe(state);
  });

  it('removes a placed ship and re-selects it', () => {
    let state = reducer(createInitialState(), { type: 'placeShip', index: toIndex(0, 0) });
    state = reducer(state, { type: 'removeShip', id: 'carrier' });
    expect(state.playerBoard.ships).toHaveLength(0);
    expect(state.selectedShip).toBe('carrier');
  });

  it('randomize and resetPlacement fill and clear the fleet', () => {
    let state = reducer(createInitialState(), { type: 'randomize' });
    expect(allShipsPlaced(state.playerBoard)).toBe(true);
    expect(isBoardValid(state.playerBoard)).toBe(true);
    state = reducer(state, { type: 'resetPlacement' });
    expect(state.playerBoard.ships).toHaveLength(0);
    expect(state.selectedShip).toBe(SHIP_SPECS[0].id);
  });

  it('ignores placement actions once the battle has started', () => {
    const playing = reducer(placeAll(), { type: 'start' });
    for (const action of [
      { type: 'placeShip', index: toIndex(9, 9) },
      { type: 'removeShip', id: 'carrier' },
      { type: 'randomize' },
      { type: 'selectShip', id: 'carrier' },
      { type: 'resetPlacement' },
      { type: 'toggleOrientation' },
      { type: 'setOrientation', orientation: 'vertical' },
    ] as const) {
      expect(reducer(playing, action)).toBe(playing);
    }
    // Also true once the game is over.
    const over = { ...playing, phase: 'gameover' as const };
    expect(reducer(over, { type: 'resetPlacement' })).toBe(over);
    expect(reducer(over, { type: 'toggleOrientation' })).toBe(over);
  });

  it('toggles orientation and starts a new game from scratch', () => {
    const rotated = reducer(createInitialState(), { type: 'toggleOrientation' });
    expect(rotated.orientation).toBe('vertical');
    expect(reducer(rotated, { type: 'toggleOrientation' }).orientation).toBe('horizontal');
    const fresh = reducer(reducer(placeAll(), { type: 'start' }), { type: 'newGame' });
    expect(fresh).toEqual(createInitialState());
  });

  it('declares the AI winner when it destroys the player fleet', () => {
    let state = reducer(placeAll(), { type: 'start' });
    for (let i = 0; i < 200 && state.phase === 'playing'; i += 1) {
      state = reducer({ ...state, turn: 'ai' }, { type: 'aiShot' });
    }
    expect(state.phase).toBe('gameover');
    expect(state.winner).toBe('ai');
    expect(state.log[0]).toBe('Your fleet has been destroyed. Defeat.');
  });

  it('blocks shooting after the game is over', () => {
    const over = { ...reducer(placeAll(), { type: 'start' }), phase: 'gameover' as const };
    expect(reducer(over, { type: 'playerShot', index: 3 })).toBe(over);
  });
});
