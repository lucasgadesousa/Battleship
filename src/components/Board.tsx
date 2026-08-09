import { Fragment, useMemo } from 'react';
import { CELL_COUNT, type Board } from '../game/types';
import { isShipSunk, toCoords } from '../game/board';

const COLUMN_LABELS = 'ABCDEFGHIJ'.split('');

export type CellState =
  | 'empty'
  | 'ship'
  | 'ship-sunk'
  | 'hit'
  | 'miss'
  | 'preview'
  | 'preview-invalid';

interface BoardViewProps {
  board: Board;
  /** Reveal un-hit ships (own board) or keep them hidden (enemy board). */
  revealShips: boolean;
  previewCells?: number[];
  previewValid?: boolean;
  interactive?: boolean;
  onCellClick?: (index: number) => void;
  onCellEnter?: (index: number) => void;
  onCellLeave?: () => void;
  label: string;
}

export function BoardView({
  board,
  revealShips,
  previewCells = [],
  previewValid = true,
  interactive = false,
  onCellClick,
  onCellEnter,
  onCellLeave,
  label,
}: BoardViewProps) {
  const shipCellMap = useMemo(() => {
    const map = new Map<number, boolean>();
    for (const ship of board.ships) {
      const sunk = isShipSunk(ship);
      for (const cell of ship.cells) map.set(cell, sunk);
    }
    return map;
  }, [board.ships]);

  const preview = useMemo(() => new Set(previewCells), [previewCells]);
  const hits = useMemo(() => new Set(board.hits), [board.hits]);
  const misses = useMemo(() => new Set(board.misses), [board.misses]);

  const cellState = (index: number): CellState => {
    if (preview.has(index)) return previewValid ? 'preview' : 'preview-invalid';
    if (hits.has(index)) return shipCellMap.get(index) ? 'ship-sunk' : 'hit';
    if (misses.has(index)) return 'miss';
    if (shipCellMap.has(index) && (revealShips || shipCellMap.get(index))) return 'ship';
    return 'empty';
  };

  return (
    <div className="board" aria-label={label}>
      <div className="board-corner" />
      {COLUMN_LABELS.map((letter) => (
        <div key={letter} className="board-label">
          {letter}
        </div>
      ))}
      {Array.from({ length: CELL_COUNT }, (_, index) => {
        const { row, col } = toCoords(index);
        const state = cellState(index);
        const shot = hits.has(index) || misses.has(index);
        return (
          <Fragment key={index}>
            {col === 0 && <div className="board-label">{row + 1}</div>}
            <button
              type="button"
              className={`cell cell-${state}`}
              disabled={!interactive || (shot && !revealShips)}
              aria-label={`${label} ${COLUMN_LABELS[col]}${row + 1} ${state}`}
              onClick={() => onCellClick?.(index)}
              onMouseEnter={() => onCellEnter?.(index)}
              onMouseLeave={() => onCellLeave?.()}
            >
              {state === 'hit' || state === 'ship-sunk' ? '✕' : state === 'miss' ? '•' : ''}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
