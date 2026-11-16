# Four-Player Multiverse Chess

The `main` branch contains the deployed Classic and Live movement modes, physical travel and collisions, shared timelines, compulsory Present-board moves, and the account/collection experience. See [Accounts and ratings](docs/accounts-and-ratings.md), [Collections and economy](docs/collections.md), and [Movement rules](docs/movement-modes.md). The Node backend uses transactional SQLite storage with a verified one-time import of legacy saves; see [Server architecture and operations](docs/server-storage.md). The client API, cookies, public paths and existing games remain compatible.

[Play at chess.316123.nl](https://chess.316123.nl/)

Two to four human factions plan private orders on one device or online. Two players use a classic 8×8 board, three use a cross with one wing removed, and four use the full cross. The public landing page starts in four-player local mode; the logged-in lobby asks for a player count when starting local or online play. Once everyone locks in, all orders resolve together. Pieces can move through time, fork historical positions, and use Temporal Rifts. Capture any copy of a faction’s king to eliminate that faction.

## Run locally

Use Node.js 24 or later and a current browser.

```sh
npm ci
npm run dev
```

Open [http://127.0.0.1:4173/chess/](http://127.0.0.1:4173/chess/). Red starts immediately. The game menu provides New match and JSON import and export. The app stores its autosave on the current browser and origin. A save contains the complete game journal and any private orders entered so far.

- Click a piece and then a highlighted destination. Use Cycle route if several legal paths reach the same square.
- Drag the scene to pan. Scroll or pinch to zoom. The camera bar can fit all timelines, focus a selection or inspected board, or return to the current player’s activity.
- With the canvas focused, use arrow keys to move across squares, Shift + arrows to change board nodes, Enter to select, and WASD to pan. F fits the multiverse, Z focuses the selection, and 0 resets to a Present frontier.
- The round history steps through committed snapshots in the same canvas. Play round reruns the reveal animation.

See [RULES.md](RULES.md) for complete movement and conflict rules.

## Checks

```sh
npm test
npm run build
npx playwright install --only-shell chromium
npm run test:browser
```

Set `CHROMIUM_EXECUTABLE` to use an existing Chromium for the browser tests. The unit tests cover the resolver, movement, branching, activation, save journal, and online rooms with two to four seats. The browser suite drives all four seats through a branch and a Rift, checks the new mode selection and boards, and exercises replay, autosave, and save transfer.

## Deploy under /chess/

`npm run build` produces the site at `dist/chess/` and a small static-only Cloudflare Worker at `.cloudflare/worker.mjs`. Every page asset uses the `/chess/` base path. The site has no external runtime dependencies.

**Existing static host.** Copy the generated `dist/chess/` folder into the existing website’s deployment output and publish that output as usual. Keep the existing host’s directory index handling enabled for `/chess/`.

**Automatic deploys from `main`.** The Cloudflare Worker is configured by [wrangler.jsonc](wrangler.jsonc), including the chess hostname root redirect and routes under `/chess/`. `npm run deploy` builds the site and publishes the Worker with Wrangler. Cloudflare Workers Builds is connected to this repository's `main` branch. Each push to `main` builds the app and deploys it to the existing Worker. Its deploy command uses the pinned Wrangler version in `package-lock.json`.

To update the Worker manually from a development machine, authenticate Wrangler with a Cloudflare account that has Workers Scripts Edit on the account and Workers Routes Edit on the zone, then run:

```sh
npm ci
npm run deploy
```

`https://chess.316123.nl/` redirects to `/chess/`. Cloudflare serves all game pages and assets under that path. Requests to `/api/*` bypass the static Worker and use the dedicated API-only Cloudflare Tunnel to the Raspberry Pi. The Pi runs one authentication and game server under PM2; it is bound to loopback and is not the public page host. See [Multiplayer setup](docs/multiplayer.md) for the process and persistence details. The former `316123.nl/chess` routes have been removed.

[Cloudflare Worker route documentation](https://developers.cloudflare.com/workers/configuration/routing/routes/) · [Cloudflare Worker upload API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/methods/update/)

## Code map

| File | Role |
| --- | --- |
| `src/model.ts` | Immutable board and timeline data, geometry, activation, Present |
| `src/moves.ts` | Universe route search, movement, occupancy, castling, en passant |
| `src/resolve.ts` | Order validation, claims and departures, capture, branch and Rift creation |
| `src/scene.ts` | Canvas rendering, camera, minimap, check highlights and reveal |
| `src/geometry.ts` | Shared client/server board layout and path distances |
| `src/continuous.ts` | Live tick speeds, swept collisions and recorded playback traces |
| `src/rules.ts` | Required Present-board orders |
| `src/awareness.ts` | Check detection and client plan preview |
| `src/shell.ts` / `src/portal.ts` | Shared topbar, dashboard and account flows |
| `server/accounts.ts` | Merged Elo, hidden pool statistics and game rewards |
| `server/economy.ts` / `src/collection.ts` | Reward odds, Dutch resets, wallets, copies and escrow trading |
| `src/store.ts` / `src/rewards.ts` | Shop, inventory, market and saved reward animations |
| `src/art.ts` / `src/skin-designs.ts` / `src/cosmetic-art.ts` | Shared filled vector art, skin silhouettes and collectible icons |
| `src/main.ts` | Pass-and-play flow, planning controls, round history |
| `src/session.ts` | Deterministic save journal and replay reconstruction |

[5dcol](https://github.com/ForkKILLET/5dcol) informed the board-history model, geometric target generation, camera and preview workflow. This implementation uses its own engine and artwork.

### First-user usage telemetry

The first 100 **created account IDs**, including existing accounts, receive a private rolling usage record. `DATA_DIR/telemetry.sqlite` stores at most **10,000,000 UTF-8 JSON bytes per account**; each insert trims the oldest events for that account. This separate database does not change the main game database schema. No analytics data is sent to a third party.

Client events capture button/link activation, safe selector/label, pointer position, non-text option changes, navigation, visibility, viewport, error type/source location, and reported coin/Elo balances. Server events record authenticated API route, method, status, duration and authoritative balances before/after. Request IDs and action IDs connect UI actions to server results. Events carry client time and server receive time in epoch milliseconds, plus a browser-tab session ID and sequence. Game-board square/canvas clicks and raw request bodies, passwords, cookies, session tokens, free-text fields, and error stacks are excluded.

The client sends small authenticated batches every three seconds and on navigation, retains a bounded retry queue in session storage, and deduplicates retries on the server. Collection starts after the server verifies cohort eligibility. Telemetry failures do not turn successful gameplay requests into failures. Browser blocking/offline closure can still prevent delivery; this is a diagnostic event stream rather than a video replay.

Operator access is through SSH, not a public log endpoint:

```sh
DATA_DIR=/home/pablo/chess-data node scripts/telemetry-admin.mjs summary
DATA_DIR=/home/pablo/chess-data node scripts/telemetry-admin.mjs export ExactUsername /private/new-file.jsonl
```

Exports are chronological JSONL, created with mode `600` and never overwrite an existing file. The database file is also created with mode `600`. The main `storage-admin` backup covers game/account data; back up `telemetry.sqlite` separately with SQLite's backup API when retaining diagnostic history.

Archived pre-mode games can be audited with `DATA_DIR=... node scripts/backfill-legacy-ratings.mjs`. The explicit `--apply` action makes a verified game-database backup, replays completed legacy games from 1200 in creation order using production scoring, adds only the resulting deltas to current balances, and writes an idempotent settlement ledger. It preserves gambling losses and coin balances.
