# Player profiles

Signed-in members can open `/chess/profile.html?user=NAME`. Avatar, name and Elo in the header link to the owner's profile; the hamburger alone opens account actions. Player identities also link from both leaderboards, market listings and purchase confirmations, match seats, the player's match sidebar and history opponents.

A card shows its active icon and animated frame, a plain-text description (280 characters), rating, rank, rated-game count and recorded match outcomes. Up to three different owned skin designs can be showcased, each with a permitted piece kind and any faction color. Legacy universal copies retain all six kinds. The owner can edit the icon, frame, bio and showcases in one dialog; the server validates availability and ownership before applying the complete change. Listed or pending copies cannot be showcased. Unavailable copies disappear from the public projection without deleting the saved choice, so cancelling escrow can restore a showcase.

## APIs and storage

`GET /api/profile?user=NAME` returns a narrow member-visible projection. It never returns wallets, sessions, password material, request receipts or account notifications. `GET /api/profile/edit` returns only the authenticated owner's eligible choices. `POST /api/profile` saves their identity and icon/frame together; optimistic revisions reject stale edits. Account JSON gains an optional `publicIdentity` field, preserving schema 1 and existing inventory. New completed matches record `finishedAt`; legacy history falls back to creation time.

`GET /api/profile/history?user=NAME&tab=games|casino&before=CURSOR` returns 20 rows and a keyset cursor. Match history uses the existing indexed membership relation and thin SQL projections, not full game-board hydration. Private match names, opponents and replay links appear only to participants. Match outcome counts include recorded completed games; the separate rated-game count retains the account's existing rating statistics.

Gambling history uses the existing saved recent-wager receipts (up to 100 per account). Elo wins appear as `????? +N coins` in gambling history; Elo losses appear as `????? −N Elo` only in game history. These projected entries omit room identity, stake, face, requests and valuation metadata. Both show subtle static/glitch styling with reduced-motion support. Normal coin wagers show Dice/Roulette and their net coin change.

## Validation

Tests cover cross-account edit rejection, private projections, ownership by piece kind, duplicate designs, stale revisions, failed-commit rollback, restart persistence, unavailable copies, mixed history pagination and masked Elo entries. Browser tests save a full card, change frame/avatar/showcases, verify profile links, load history pages and check both view/editor layouts down to 320 pixels.
