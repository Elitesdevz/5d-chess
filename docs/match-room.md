# Match room

Local and online matches share a compact match header, player/status strip, board stage and planning rail. The design covers two-, three- and four-player boards, Classic/Live, legacy saves, AI opponents and replay. Shop/casino navigation remains accessible through Explore; wallet and profile controls remain in the header.

The desktop rail is docked outside the canvas. On phones/tablets, its collapsed summary opens an expandable planning sheet; landscape phones use a compact side rail. Camera controls remain on the board, with advanced overlays grouped in Layers. Selection details explain movement timing and warn that ordinary Live captures are mutual trades, including dangerous king collisions. Required/optional counts indicate remaining orders, and frontier chips focus outstanding boards. Historical/replay states do not show live planning obligations.

The default shallow 2.5D view uses an affine projection (x shear 0.16, y scale 0.82), shaded board decks, raised rims and upright cached piece sprites. Custom skins, silhouettes, movement effects and capture effects are retained. A saved top-down preference is available. Tutorials retain their flat teaching view.

`board-view.ts` contains presentation-only transforms. Pointer picking, panning and cursor-anchored zoom invert that transform; fitting and the minimap account for the projected viewport. Logical geometry, collision simulation, rules, stored games and server settlement are unchanged. Default piece vectors and up to 96 relief sprites are cached; the interface honours reduced-motion preferences.

Validation covers known projection coordinates/inverse picking, real angled moves for every player count, top-down preference reloads, multi-board required/optional plans, narrow signed-in headers, mobile/landscape controls, private handoffs, branch/Rift save/replay/import, AI matches and all tutorial lessons.
