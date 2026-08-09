# Battleship

Single-player Battleship against an AI opponent. React 19 + TypeScript + Vite,
all state in the browser — no page reloads, no backend.

**Play:** https://dist-isjktnwl.devinapps.com

## Rules

Standard Battleship on a 10×10 grid. Fleet: Carrier (5), Battleship (4),
Cruiser (3), Submarine (3), Destroyer (2). Place your ships, hit **Start
Battle**, then trade shots with the AI until one fleet is gone.

## Controls

- Click a ship in the list, then click your board to place it. Click a placed
  ship again to pick it up.
- **R** or the **Rotate** button flips between horizontal and vertical.
- **Random fleet** / **Clear** for quick setup.
- **Start Battle** unlocks once all five ships are on the board.

Each board shows a fleet roster: a destroyed ship is described in full (name,
size, span and orientation, e.g. `Destroyed — C5–G5, horizontal, 5 hits`), and
the battle log records the coordinate of every shot. Enemy ships stay hidden
until they are sunk.

## Development

Requires Node 22 (see `.nvmrc`).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # game-logic unit tests
npm run lint
npm run typecheck
npm run build
```

## Layout

```
src/game/types.ts   board size, fleet spec, shared types
src/game/board.ts   placement, firing, sunk detection
src/game/ai.ts      hunt/target AI with parity search
src/game/state.ts   reducer: the single source of truth for game rules
src/components/     Board grid rendering
src/App.tsx         screen layout, AI turn timer, modal
```

Game rules live entirely in the reducer, so the components can stay dumb and
the rules are unit-testable without a DOM.

## Bugs found and fixed

See [BUGS.md](./BUGS.md).
