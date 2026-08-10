import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { BoardView } from './components/Board';
import { canPlace, isShipSunk, shipCells, shipOrientation, shipRange } from './game/board';
import { allShipsPlaced, createInitialState, reducer } from './game/state';
import { SHIP_SPECS, type Board, type ShipId } from './game/types';

/**
 * Per-ship roster for a fleet. Sunk ships are described in full (size, span,
 * orientation); enemy ships that are still afloat stay hidden.
 */
function FleetStatus({ board, hideAfloat }: { board: Board; hideAfloat?: boolean }) {
  const sunkCount = board.ships.filter(isShipSunk).length;
  return (
    <div className="fleet-status">
      <p className="counter">
        Sunk: {sunkCount} / {SHIP_SPECS.length}
      </p>
      <ul className="fleet-status-list">
        {SHIP_SPECS.map((spec) => {
          const ship = board.ships.find((s) => s.id === spec.id);
          const sunk = ship ? isShipSunk(ship) : false;
          return (
            <li key={spec.id} className={sunk ? 'sunk' : 'afloat'}>
              <span className="fleet-status-name">
                {spec.name} ({spec.size})
              </span>
              <span className="fleet-status-detail">
                {sunk && ship
                  ? `Destroyed — ${shipRange(ship)}, ${shipOrientation(ship)}, ${ship.size} hits`
                  : hideAfloat
                    ? 'Position unknown'
                    : ship
                      ? `Afloat — ${shipRange(ship)}, ${ship.hits.length}/${ship.size} hits`
                      : 'Not placed'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Colour key for the cell states of a board. */
function Legend({ own }: { own: boolean }) {
  const items: { cls: string; mark?: string; text: string }[] = [
    { cls: 'cell-empty', text: own ? 'Open water' : 'Not fired at' },
    { cls: 'cell-miss', mark: '•', text: own ? 'Enemy missed' : 'Miss (already fired)' },
    { cls: 'cell-hit', mark: '✕', text: 'Hit' },
    { cls: 'cell-ship-sunk', mark: '✕', text: 'Sunk ship' },
  ];
  if (own) items.splice(1, 0, { cls: 'cell-ship', text: 'Your ship' });
  return (
    <ul className="legend">
      {items.map((item) => (
        <li key={item.text}>
          <span className={`legend-swatch ${item.cls}`}>{item.mark ?? ''}</span>
          {item.text}
        </li>
      ))}
    </ul>
  );
}

const AI_DELAY_MS = 700;

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const [hover, setHover] = useState<number | null>(null);

  const selectedSpec = useMemo(
    () => SHIP_SPECS.find((spec) => spec.id === state.selectedShip) ?? null,
    [state.selectedShip],
  );

  // Off-board placements have no cells, so highlight the hovered square alone
  // to keep the invalid feedback visible.
  const previewCells = useMemo(() => {
    if (state.phase !== 'placement' || hover === null || !selectedSpec) return [];
    return shipCells(hover, selectedSpec.size, state.orientation) ?? [hover];
  }, [hover, selectedSpec, state.orientation, state.phase]);

  const previewValid =
    state.phase === 'placement' &&
    hover !== null &&
    selectedSpec !== null &&
    canPlace(state.playerBoard, hover, selectedSpec.size, state.orientation);

  // The AI takes its turn on a timer so the player can follow the exchange.
  useEffect(() => {
    if (state.phase !== 'playing' || state.turn !== 'ai') return;
    const timer = window.setTimeout(() => dispatch({ type: 'aiShot' }), AI_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.turn]);

  useEffect(() => {
    if (state.phase !== 'placement') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'r' || event.key === 'R') dispatch({ type: 'toggleOrientation' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.phase]);

  const handlePlayerCell = useCallback(
    (index: number) => {
      if (state.phase === 'playing') dispatch({ type: 'playerShot', index });
    },
    [state.phase],
  );

  const placedIds = new Set(state.playerBoard.ships.map((ship) => ship.id));
  const ready = allShipsPlaced(state.playerBoard);

  const status =
    state.phase === 'placement'
      ? ready
        ? 'Fleet ready — press Start Battle.'
        : selectedSpec
          ? `Place your ${selectedSpec.name} (${selectedSpec.size}) — press R to rotate.`
          : 'Select a ship to place.'
      : state.phase === 'gameover'
        ? state.winner === 'human'
          ? 'You win!'
          : 'You lose.'
        : state.turn === 'human'
          ? 'Your turn — fire at the enemy waters.'
          : 'Enemy is taking aim…';

  return (
    <div className="app">
      <header className="header">
        <h1>Battleship</h1>
        <p className="status">{status}</p>
      </header>

      <main className="layout">
        <section className="panel">
          <h2>Your fleet</h2>
          <BoardView
            label="Your fleet"
            board={state.playerBoard}
            revealShips
            interactive={state.phase === 'placement'}
            previewCells={previewCells}
            previewValid={previewValid}
            onCellClick={(index) => dispatch({ type: 'placeShip', index })}
            onCellEnter={(index) => setHover(index)}
            onCellLeave={() => setHover(null)}
          />
          <Legend own />
          <FleetStatus board={state.playerBoard} />
        </section>

        <section className="panel controls">
          {state.phase === 'placement' ? (
            <>
              <h2>Place your ships</h2>
              <ul className="ship-list">
                {SHIP_SPECS.map((spec) => {
                  const placed = placedIds.has(spec.id);
                  return (
                    <li key={spec.id}>
                      <button
                        type="button"
                        className={`ship-button${state.selectedShip === spec.id ? ' selected' : ''}${
                          placed ? ' placed' : ''
                        }`}
                        onClick={() =>
                          placed
                            ? dispatch({ type: 'removeShip', id: spec.id as ShipId })
                            : dispatch({ type: 'selectShip', id: spec.id as ShipId })
                        }
                      >
                        <span className="ship-name">{spec.name}</span>
                        <span className="ship-pips">
                          {Array.from({ length: spec.size }, (_, i) => (
                            <span key={i} className="pip" />
                          ))}
                        </span>
                        <span className="ship-action">{placed ? 'Remove' : 'Place'}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="button-row">
                <button type="button" onClick={() => dispatch({ type: 'toggleOrientation' })}>
                  Rotate ({state.orientation})
                </button>
                <button type="button" onClick={() => dispatch({ type: 'randomize' })}>
                  Random fleet
                </button>
                <button type="button" onClick={() => dispatch({ type: 'resetPlacement' })}>
                  Clear
                </button>
              </div>
              <button
                type="button"
                className="primary"
                disabled={!ready}
                onClick={() => dispatch({ type: 'start' })}
              >
                Start Battle
              </button>
            </>
          ) : (
            <>
              <h2>Battle log</h2>
              <ul className="log">
                {state.log.map((entry, i) => (
                  <li key={`${i}-${entry}`}>{entry}</li>
                ))}
              </ul>
              <button
                type="button"
                className="primary"
                onClick={() => dispatch({ type: 'newGame' })}
              >
                New game
              </button>
            </>
          )}
        </section>

        <section className="panel">
          <h2>Enemy waters</h2>
          <BoardView
            label="Enemy waters"
            board={state.aiBoard}
            revealShips={state.phase === 'gameover'}
            interactive={state.phase === 'playing' && state.turn === 'human'}
            onCellClick={handlePlayerCell}
          />
          <Legend own={false} />
          <FleetStatus board={state.aiBoard} hideAfloat={state.phase !== 'gameover'} />
        </section>
      </main>

      {state.phase === 'gameover' && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h2>{state.winner === 'human' ? 'Victory!' : 'Defeat'}</h2>
            <p>
              {state.winner === 'human'
                ? 'You sank the entire enemy fleet.'
                : 'The enemy sank your entire fleet.'}
            </p>
            <button type="button" className="primary" onClick={() => dispatch({ type: 'newGame' })}>
              Play again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
