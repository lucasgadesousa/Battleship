# Battleship — debugging report

What broke while building the game, how it was found, and how it was fixed.
Every logic fix is locked in by a test in `src/game/game.test.ts` (15 tests, `npm test`).

## 1. Ships wrapped around the right edge of the board

**Symptom.** A horizontal Carrier placed on column H appeared as a few cells on
row 3 and the rest on row 4.

**Cause.** The board is a flat 100-cell array and cells were generated with
`start + i`, which happily crosses a row boundary.

**Fix.** `shipCells()` in `src/game/board.ts` now returns `null` unless the
whole ship fits inside one row (horizontal) or inside the board (vertical):

```ts
if (orientation === 'horizontal' && col + size > BOARD_SIZE) return null;
if (orientation === 'vertical' && row + size > BOARD_SIZE) return null;
```

`canPlace()`/`placeShip()` treat `null` as "illegal", so the UI simply refuses
the placement. Covered by the "rejects horizontal placement that would wrap"
and "rejects vertical placement past the bottom" tests.

## 2. A ship could be placed twice / stacked on itself

**Symptom.** Clicking the same ship in the fleet list and placing it again left
two copies on the board, and "Start Battle" enabled with fewer than five ships
visible.

**Cause.** Placement only checked cell occupancy, not whether that ship id was
already on the board.

**Fix.** `placeShip()` rejects an id that is already placed, and re-selecting a
placed ship dispatches `removeShip` first, so the ship is picked up before it
is put down again. Covered by "rejects placing the same ship twice".

## 3. Firing at the same cell twice consumed a turn

**Symptom.** Clicking an already-missed cell on the enemy board handed the turn
to the AI, so the player lost a shot for free.

**Cause.** `fireAt()` appended to the shot list unconditionally.

**Fix.** `fireAt()` returns the *same board object* for a repeat shot, and the
reducer bails out on identity (`if (board === state.aiBoard) return state;`),
leaving the turn untouched. The cell is also rendered `disabled`. Covered by
"ignores repeat shots".

## 4. The AI kept shooting at cells it had already hit

**Symptom.** After a hit, the AI re-fired at neighbouring cells it had already
tried, wasting turns and making the game trivially easy.

**Cause.** The neighbour queue was filled without filtering against past shots,
and it was not cleared when a ship went down, so the AI chased a wreck.

**Fix.** `updateAiAfterShot()` filters candidates through `alreadyShot()` and
drops the whole target queue when `sunk` is true; the hunt phase then resumes
on a parity grid (only cells where `(row + col) % 2 === 0`), which is the
standard optimal search for a minimum ship length of 2. Covered by the three
AI tests.

## 5. "All ships sunk" fired on an empty board

**Symptom.** In an early build the game jumped straight to the victory modal.

**Cause.** `allShipsSunk()` used `Array.prototype.every()`, which is `true` for
an empty ship list — and the enemy board is empty until `start` generates it.

**Fix.** `allShipsSunk()` returns `false` when there are no ships, and the AI
board is only generated inside the `start` action. Covered by "an empty board
is not all-sunk".

## 6. The player could shoot during the AI's turn (and after the game ended)

**Symptom.** Rapid clicking on the enemy board fired several shots in a row
before the AI replied; clicking after the win modal appeared kept mutating the
board behind the modal.

**Cause.** The click handler dispatched unconditionally.

**Fix.** All turn/phase rules live in the reducer, not in the components:
`playerShot` is ignored unless `phase === 'playing' && turn === 'human'`, and
`aiShot` unless it is the AI's turn. The board is additionally rendered
non-interactive. Covered by "ignores player shots on the AI turn" and "ignores
shots after the game is over".

## 7. The AI's turn timer leaked on "New game"

**Symptom.** Starting a new game while the AI was "taking aim" produced a
phantom enemy shot in the fresh game.

**Cause.** The `setTimeout` that delays the AI move was not cancelled when the
component's state changed.

**Fix.** The effect returns `clearTimeout`, and the effect is keyed on
`[phase, turn]` only, so a stale timer can never survive a reset:

```ts
useEffect(() => {
  if (state.phase !== 'playing' || state.turn !== 'ai') return;
  const timer = window.setTimeout(() => dispatch({ type: 'aiShot' }), AI_DELAY_MS);
  return () => window.clearTimeout(timer);
}, [state.phase, state.turn]);
```

An earlier version also had `state.log.length` in the dependency array; because
the log is capped at 40 entries, that value stops changing in long games, and
React warned about a changing dependency-array size during development. Both
issues disappeared with the smaller, stable dependency list.

## 8. Invalid placements gave no feedback at the board edges

**Symptom.** Hovering near the right/bottom edge with a long ship showed
*nothing at all* — the player could not tell whether the game had registered
the hover.

**Cause.** `shipCells()` returns `null` off-board, and the preview rendered an
empty array.

**Fix.** The preview falls back to the hovered square alone, which is styled
red/invalid, so the rejection is visible:

```ts
return shipCells(hover, selectedSpec.size, state.orientation) ?? [hover];
```

## 9. React key warning on the grid rows

**Symptom.** `Each child in a list should have a unique "key" prop` in the
console while rendering the 10×10 grid.

**Cause.** Row labels and their ten cells were emitted from a `map()` inside a
shorthand `<>…</>` fragment, which cannot take a key.

**Fix.** `Board.tsx` uses `<Fragment key={index}>` explicitly. The console is
now clean on load, during placement, and through a full game.

## 10. Tooling: `npm test` and `npm run lint` failed with "Cannot find native binding"

**Symptom.** Vitest (`@rolldown/binding-*`) and Oxlint
(`./oxlint.linux-x64-gnu.node`) both refused to start.

**Cause.** The sandbox ran Node 20.18.1; Vite 7 requires Node ≥ 20.19 / 22.12
and the optional platform binaries had not been installed for this platform.

**Fix.** Node 22 (via nvm) plus a clean install; `.nvmrc` pins `22` so the next
person does not hit it. `npm run lint`, `npm run typecheck`, `npm test` and
`npm run build` all pass.

## How it was verified

- `npm test` — 15 unit tests over placement, firing, win detection, turn order
  and AI behaviour.
- Manual play in Chrome: manual placement with rotation, random fleet, clear,
  start, a full exchange of shots.
- Two scripted full games driven from the browser console (one shot every
  100 ms until the game ended) to reach both terminal states without hand
  clicking ~100 cells:
  - **Defeat** — "The enemy sank your entire fleet.", enemy fleet revealed,
    "Ships lost: 5 / 5".
  - **Victory** — "You sank the entire enemy fleet.", "Enemy ships sunk: 5 / 5".
- The browser console stays free of React errors and warnings for both runs.
