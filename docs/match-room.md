# Match room

Local and online matches share a compact match header, player/status strip, board stage and planning rail. The design covers two-, three- and four-player boards, Classic/Live, legacy saves, AI opponents and replay. Shop/casino navigation remains accessible through Explore; wallet and profile controls remain in the header.

The desktop rail is docked outside the canvas. On phones/tablets, its collapsed summary opens an expandable planning sheet; landscape phones use a compact side rail. Camera controls remain on the board, with advanced overlays grouped in Layers. Selection details explain movement timing and explain that Live captures stop on stationary targets while opposing moving pieces trade. Required/optional counts indicate remaining orders, and frontier chips focus outstanding boards. Historical/replay states do not show live planning obligations.

The default shallow 2.5D view uses an affine projection (x shear 0.16, y scale 0.82), shaded board decks, raised rims and upright cached piece sprites. Custom skins, silhouettes, movement effects and capture effects are retained. A saved top-down preference is available. Tutorials retain their flat teaching view.

`board-view.ts` contains presentation-only transforms. Pointer picking, panning and cursor-anchored zoom invert that transform; fitting and the minimap account for the projected viewport. The UI-Polish reconciliation retains its new Live capture and friendly-bounce rules; the visual projection remains independent of logical geometry. Default piece vectors and up to 96 relief sprites are cached; the interface honours reduced-motion preferences.

Validation covers known projection coordinates/inverse picking, real angled moves for every player count, top-down preference reloads, multi-board required/optional plans, narrow signed-in headers, mobile/landscape controls, private handoffs, branch/Rift save/replay/import, AI matches and all tutorial lessons.

## UI-Polish reconciliation

Guest landing now offers a saved local Live game against Pip, with account features gated through the compact Explore menu. Live attackers capture stationary pieces and stop; opposing movers trade and friendly movers bounce. Per-piece movement/capture loadouts render through the raised-piece pipeline. Old local Live journals retain their original collision history via a persisted journal boundary, then adopt current rules for subsequent rounds; online histories keep their stored resolved states. Simultaneous attackers reaching a stationary target are resolved before board placement, preventing a silent overwrite.

Classic optional orders have no shared quota: each owned eligible frontier can contribute once. Live allows one optional order per active Present board, capped at three, independent of inactive timeline stockpiles. Planning counters and AI use those same rules. Instant movement resolves kings before knights before normal departures. Narrow-screen resizing focuses the playable board rather than shrinking every historical board into the viewport.
