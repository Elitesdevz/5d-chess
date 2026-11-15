# The first 30: guided tutorial puzzles

Home → Learn to play opens `/chess/puzzles.html`. Thirty handcrafted positions form six chapters of five lessons. All lessons can be visited or replayed through the course map; nothing is locked behind completion. The final lesson leads into the AI opponent gallery.

| Chapter | Lessons | Skills |
| --- | --- | --- |
| First moves | 1–5 | Selecting orders, pawn advances/captures, rook and bishop geometry |
| Your army | 6–10 | Knight, queen, advisory check, castling and automatic promotion |
| Live combat | 11–15 | Mutual trades, king survival, instant interceptions, speed and en passant |
| Beyond the board | 16–20 | Frontiers, branching, universe movement, space/time diagonals and three-axis queens |
| Shared timelines | 21–25 | Dimensional knights, intangible travel, historical kings, shared arrivals and Rifts |
| The complete plan | 26–30 | Every Present board, optional sources, friendly departures, four factions and a combined final operation |

Each lesson includes a playable position, introductory explanation, objective, two hints, a worked plan, failure feedback and a completion explanation. Gold rings identify exercise targets. Fixed enemy orders are drawn and listed before submission. Training freezes unlisted enemy pieces; the page explicitly distinguishes this from hidden opponent plans in a real Live match.

The actual move generator and resolver evaluate attempts. The human must cover their compulsory Present sources and may use at most one optional source. Tutorials use partial resolution only to freeze unlisted opposing plans. Multi-order objectives require complete plans, and goal predicates accept alternate successful tactics where appropriate; the supplied worked line is not the only accepted solution.

The existing canvas supports pointer and keyboard interaction, with coordinate-based source/destination controls as an accessible alternative. Board tabs focus individual snapshots, with Fit and zoom controls for the whole position. Failed legal plans can be animated and retried freely. Hints and worked plans carry no penalty.

Signed-in completion is revalidated by `/api/puzzles/:id/solve` and persisted as an optional `puzzleCompleted` field on the account. Progress is idempotent and separate for each account. Offline attempts retain their actual orders in a browser queue and retry verification when connectivity returns. Guest progress stays local to the browser and is kept separate from account progress. Each first verified account completion awards 25 coins; repeats award none. Lessons do not change Elo. Previously completed lessons are not rewarded retroactively.

Validation includes all 30 worked solutions, illegal and incomplete plans, live king suicide, alternative interceptions, durable account isolation, a browser run through all 30 lessons, desktop/mobile layouts, guest reloads and interrupted account synchronization.
