# AI duels

Home → Play with AI opens five named opponents. Each is a two-player, unrated duel using the same Live or Classic multiverse rules as multiplayer. Human players are Red and the AI is Yellow. Classic shuffles its turn order normally. An unfinished duel can be continued; at most one unfinished duel per opponent is created for each account. AI rooms do not occupy the 50 multiplayer slots and cannot be joined by another account.

| Opponent | Difficulty | Strategy | First daily victory |
| --- | --- | --- | ---: |
| Pip, the Apprentice | Easy | No reply search, noisy development choices and forgiving defence | 60 |
| Brass, the Brawler | Casual | Fast rooks, pawn advances and aggressive trades | 100 |
| Iris, the Sentinel | Medium | King safety, defensive moves and instant interceptions | 160 |
| Vesper, the Timekeeper | Hard | Greater temporal preference and historical king tactics | 240 |
| Orion, the Strategist | Expert | Widest candidate/reply search and robust plan selection | 360 |

These labels describe the ladder within this game; they are not calibrated Elo ratings. A small alternating-seat smoke benchmark (eight games per mode, capped at 45 resolutions) produced Orion–Pip 7–1 in Live and 4–1 in completed Classic games, with three Classic games unfinished at the cap. This is a sanity check, not proof of competitive strength.

## Planning

`src/ai.ts` builds complete legal plans: one order on every compulsory Present source and at most one optional frontier. It uses the production move generator and resolver, including friendly collisions, instant kings/knights, historical kings, promotion and shared branches. Stronger profiles prioritize threatened-king responses and compare candidate plans with plausible replies. Classic searches the opponent's resulting turn; Live evaluates simultaneous batches from the common public snapshot. King elimination dominates material. Positional tie-breakers are capped so an unsuccessful king hunt cannot outweigh actual losses. Unnecessary branching has a cost.

The server runs one search worker at a time, outside the HTTP event loop and outside SQLite write transactions. Each worker has a memory limit and timeout. Interrupted work retries with a cheaper legal planner. Returned plans are validated again before committing, and the state round is checked to discard stale results after resignation or another state change. Search work resumes after restart.

Live AI orders are persisted before human orders are accepted. Neither the worker input nor the search routine receives a human's hidden plan. Public responses expose only readiness, not locked orders or the private seed. After each resolution the AI plans the next round. Search uses bounded effort; complex positions can receive less reply analysis.

## Rewards

Victory rewards diminish independently for each opponent, shared across Live and Classic: 100%, 50%, 25%, then 10% for every further victory that Dutch day. All tiers award coins. Day boundaries use Europe/Amsterdam, including DST; the day of completion determines the reward. Losses and draws pay nothing and do not consume a tier.

Only the server's terminal state can trigger settlement. The room's once-only receipt, account daily counts, wallet and notification commit together in SQLite. Reloads, repeated requests and restarts cannot pay again. AI duels do not change Elo, rated-game counts or rating pools; the bots are not real accounts and never appear on the leaderboard. Player game history shows the earned coins and links the opponent back to the challenge gallery.

Resignation and 48-hour inactivity forfeit work normally for the human player. Time spent waiting for AI planning does not forfeit the human, and a full deadline starts when the AI is ready. Draw offers are accepted in king-only positions and declined while other material remains.
