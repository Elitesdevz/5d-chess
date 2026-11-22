# Casino release

Dice and roulette share the existing authenticated coin wallet and SQLite transaction boundary. No new data service, tunnel, or migration is required. The `CasinoOwner` account receives a 1% tax on positive profit. If that name does not exist, the first taxable win creates a zero-balance treasury with no usable password; an existing account retains its credentials.

The server uses cryptographic random draws. Dice wins on one of six equally likely faces and returns 5.88 times the stake before tax. Roulette draws zero with 2% probability and distributes 98% equally among numbers 1–36. Outside bets return 2 times the stake, numbers return 36 times, and zero returns 49 times. These odds intentionally differ from a uniformly sampled European wheel; the rules disclose them. Stakes are whole coins from 1 to 100,000. Settlement retains four decimal places.

A dice wager's debit, payout, treasury transfer and receipt commit in one transaction. The account's monotonically increasing sequence and request ID prevent duplicate charges and rerolls. Each account retains its last 100 receipts. Dice settles when the coins are offered; the later throw presents the saved result. Reloading restores the same throw. A failed response is reconciled against server receipts before retrying the same ID.

The dice table uses procedural Three.js geometry, articulated arm rigs, a parented coin handoff, and a deterministic final die orientation. Looking requires dragging empty space or using arrow keys. Leaving the canvas or losing pointer capture cancels a gesture. Home centers the view; Space throws a held die. Projected native buttons provide keyboard and assistive-technology access to the furniture controls. A native form remains available without WebGL. Reduced-motion preferences shorten animations. Three.js loads when opening one of the casino scenes; its MIT notice is served at `/chess/third-party-notices.txt`.

Verification: `npm test` and `npm run test:browser`. Casino browser tests cover lost-response reconciliation, reload recovery, physical controls and mobile bounds, camera input, roulette selection and durable receipts. Use isolated temporary data for tests; never place synthetic wagers in a player's production wallet.

Dice also supports an alternate, consent-based Elo table. Elo wagers have no profit tax, preserve Elo on a win, remove the stake on a loss, and use a frozen Dutch-midnight valuation. Eligibility, quota, lifetime loss totals and retry recovery are enforced by the server. See [Elo wagers](elo-wagers.md) for the complete trigger rules, pricing formula and operations.

## Throw and payout presentation

Drag throws use release direction and speed to set their visible flight, bounce and spin. A final flick overrides the earlier wind-up; slow drags use displacement, and Space still throws forward. Release outside the canvas completes a captured throw. Motion cannot alter the server-set face or payout. Wins add a bounded gold coin/sparkle flourish around the handover, with a quiet reduced-motion alternative.

The blank green key on the Elo table returns to coin wagers and closes Elo offers until the next Dutch midnight. It calls the existing server decision endpoint with refusal, so the daily lock survives reload and cannot be reopened by a client trigger. It is disabled while a saved wager or presentation is in progress.

## Royal Salon

Authenticated visitors enter a shared hall with up to ten players. Each hall has three independent four-seat roulette tables. Walk with WASD, arrow keys, or the touch pad. Drag the canvas to look around, press E near a table, or use the table list to take a seat. The native betting mat and stake form are available at every seat. The page includes a 2D wheel when WebGL is unavailable.

Each table opens a 60-second betting window with the first seated player. Once everyone seated has locked a bet, or the window closes with at least one locked stake, the server draws one pocket for the table. The local camera travels from the seat to the same synchronized wheel and returns as the result is revealed. The result shows each bettor's net coins and records a private receipt under History. An empty betting window rolls over without drawing.

The server reserves each stake and records the pending ticket together in SQLite. One transaction settles all tickets at a table, records their receipts, and pays out winnings and the CasinoOwner tax. Locked tickets survive a disconnect or server restart. Player positions and the live presentation are transient. The server reuses the existing authentication, wallet, odds and API tunnel.
