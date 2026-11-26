# Meridian runtime measurements

Run `npm run world:build && node scripts/bench/city.mjs` with Node 24. Each sample covers 12 simulated seconds, with five updates per player per second. The crowd moves near the square, one player is wanted, and one player visits KFC. The result counts application JSON bytes before compression and SQLite write transactions. Step time includes all observers. It excludes HTTP and tunnel latency.

On the development host at 072e6ed the results were:

| Players | Median step, ms | 95th percentile, ms | Bytes/player/s | Transactions |
| --- | ---: | ---: | ---: | ---: |
| 2 | 3.49 | 49.88 | 51753 | 62 |
| 10 | 5.31 | 47.82 | 59567 | 70 |
| 50 | 22.55 | 81.44 | 114371 | 110 |

`CITY_BENCH=1 node --test tests/city-render.spec.mjs` measures the existing eight camera headings after shader preparation. Chromium with SwiftShader at 640×448 took 4.25 s from stage setup to first rendered frame, with 182–2180 draw calls and 3.5–62.4 ms per sampled render submission. These figures describe this host. Hardware GPU timing and production network latency require separate measurement.
