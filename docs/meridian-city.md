# Meridian city expansion

Open the City from the signed-in header. Walk with WASD or the joystick and press E or the interaction button at a counter or door. The same controls work on the overhead canvas when WebGL is unavailable.

## Bank, hotbar and homes

The middle counter at Fifth Dimension Bank exchanges whole coins between the existing wallet and carried cash. Loans, repayments, rewards and existing shops continue to use the wallet. A withdrawal leaves fractional bank balances intact.

Click a hotbar slot or press 1–9 to select it. Cash stacks in one slot. Each food stack holds nine of one menu item. Each pulse blaster occupies a separate slot. The existing Food and fridge menus work with these same slots. Takeaway collection waits if an order will not fit. Eating a carried portion restores 20 HP, and a dine-in bite restores 10, up to 100.

At the Royal, each motel key opens a private room for one hour. Store carried cash and pulse blasters in its dresser and food in its minibar. At checkout, drawer contents go to the bank recovery counter. Minibar contents return to available inventory slots, with overflow available at the same counter.

[Backstage Single](images/royal-single.webp) · [Aureate Penthouse](images/royal-penthouse.webp)

Existing SQLite accounts acquire the hotbar on first use. Older food quantities fill available slots in menu order. The cash counter holds excess for collection after space opens. Contents of an expired drawer also go to the recovery counter. Expired fridge contents fill available slots and excess goes to recovery. The legacy food field remains a projection of carried food.

The kitchen counter has a storage drawer in each house and apartment. An active deed or lease allows its resident to put away and retrieve cash and blasters. Walk up to the drawer to use it. Food goes in the existing fridge.

The arcade gun shop is at the northwest edge of town. Use its street entrance or the hotbar's City destinations menu. A pulse blaster costs 25 carried cash. Choose the blaster and a nearby target or open air, then press Fire. A shot deals 35 HP with a 900 ms recharge. Players respawn at the city entrance. The carried slots become one collectible bag at the death location. Pickup requires room for the entire bag. Banked coins, cosmetics and home contents stay with their owner. When a secondary city instance empties, its unclaimed bags move to the same coordinates in the first instance.

## Meridian Police

Enter Meridian Police on Civic Avenue or use City destinations. The front desk and booking register open from the lobby. The visitor corridor between the cells runs to cells 49 and 50. Bars separate visitors from the cell interiors. Occupied cells show their inmate even after logout or a server restart.

| Stars | Patrol | Active time to clear | Sentence |
| --- | --- | --- | --- |
| 1 | One officer searches the last reported area | 10 minutes | 2 minutes |
| 2 | Two officers, wider sight range | 20 minutes | 10 minutes |
| 3 | Three officers search suspect-owned or leased homes and seize blasters there | 40 minutes | 1 hour |
| 4 | Four officers also search nearby properties | 60 minutes | 6 hours |
| 5 | Five officers, helicopter tracking and a dog team | 90 minutes | 24 hours |

Firing adds a star. A knockout adds another, up to five. Escalation restarts clearance. Authenticated requests and the shell heartbeat count time while connected. Logout, a server restart or a gap over 30 seconds pauses accrual. Patrol advances on city updates. Delayed updates have a bounded movement step. A dog warning gives the suspect time to move away, and another attempt requires a cooldown. Officers book on contact. If all cells are occupied, the suspect keeps their wanted level until a spot opens or it clears. Searches leave other residents' belongings alone.

The shared inventory and sentence constants are in `src/world/arcade.ts`. Pursuit speed, sight, dog range, warning, cooldown and raid timing are in `server/city-arcade.ts`. The system uses game distances and a last-known-position search. NPCs return after a short recovery. Venue counters continue serving other accounts.

## Custody and moderation

Sentences use a persistent UTC deadline. Expiry applies offline, including when the next visitor opens the station. Cell assignments, transfers and pickup use the store's SQLite writer transactions. The account retains its login name. Public views use the current numbered inmate alias. Chess deadline maintenance and settlement continue while the inmate's requests to play are locked.

The custody screen shows the sentence and cell, allows movement within the cell and provides logout. Look around cell opens the city view. Permanent inmates can sit at the jigsaw table from the cell screen or from inside their 3D cell. Choose a loose piece and its location within the panorama. The board has 40 sections of 25 pieces. Correct placements save immediately, and SQLite verifies all 1,000 before puzzle release.

The operator command requires filesystem access to the intended existing SQLite directory and Node 24+. These examples target a disposable **local** database.

```sh
DATA_DIR=/tmp/chess-fixture node scripts/city-custody.mjs jail "Test Player"
DATA_DIR=/tmp/chess-fixture node scripts/city-custody.mjs jail "Test Player" --no-release
DATA_DIR=/tmp/chess-fixture node scripts/city-custody.mjs release "Test Player"
```

The flag keeps the sentence active after puzzle completion. Only an operator can lift it. There is no web moderation endpoint.

## Local verification

- `npm test` builds the clients and server and runs the Node suite. `tests/city-expansion.test.mjs` uses loopback HTTP, signed-in test accounts, temporary SQLite directories, a controlled clock and the operator CLI. It exercises migration, overflow recovery, cash conservation, full slots, HP, knockout, competing pickup, wanted timers and raids, both street entrances, cell capacity, access restrictions, aliases, offline avatars, restart and both puzzle-release modes.
- A SQLite database created by clean `main` at `8f6e310` was also reopened by the feature build. The fixture kept its 413.125 banked coins and all 95 food portions. Its nine slots held 81 portions and the recovery counter held 14.
- `tests/city-expansion.spec.mjs` uses the signup form, signed-in Bank link, keyboard movement, hotbar, shop, custody screen and jigsaw in Chromium with WebGL disabled. A second player opens the inmate’s profile through both the leaderboard and a match.
- `tests/residential.spec.mjs` walks through houses and apartment floors and uses their furnishings in Chromium. The drawer checks put away and retrieve a carried item in both property types. `tests/city-render.spec.mjs` checks WebGL scene preparation and camera turns.

Run browser tests after the build with Playwright Chromium installed, for example `node --test --test-concurrency=1 tests/city-expansion.spec.mjs tests/city-render.spec.mjs tests/residential.spec.mjs`. The tests use fixture accounts. Puzzle completion and the longest sentences are exercised through the API and test clock. The browser walkthrough fits an individual piece and reloads its progress. Two checks also fail on clean `main` at `8f6e310`. The rankings notification test times out waiting for its casino win message, and the profile editor measures 777 px at a 768 px viewport.
