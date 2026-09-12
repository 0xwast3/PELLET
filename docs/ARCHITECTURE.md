# Architecture

## One process

The runtime is a single Node process with no database and no daemon. It holds
three things in memory and writes only small files to disk.

```
data/seed.json          bootstrap set — cold start and offline runs
.pellet/runtime.json    local rules and roost, written atomically
.pellet/pellet-*.json   pellets written from the terminal with `c`
```

Nothing else persists. Killing the process loses the session, not your settings.

## The three structures

**Token universe** — a map keyed by symbol. Starts from the bootstrap set and
grows during the session as market discovery returns symbols it has not seen.
It never shrinks, so a token that stops being returned keeps its last mark and
ages out of `PRICE` instead of vanishing from the screen.

**Wallet pool** — a map keyed by handle, each with a `lastActive` stamp that
dormancy is derived from. The pool is not a frozen list: a discovery pass adds
wallets that have crossed the `SLEEP` threshold, so a long session keeps finding
new sleepers rather than draining as the seeded ones wake.

**Flow window** — per token, net USD, the set of distinct wallets involved,
ticket count and a cumulative sparkline. The set is what stops one wallet
cycling a position from looking like conviction.

## Tick

![The PELLET pipeline](../assets/how-it-works.svg)

```
tick
 ├─ every third tick: discovery pass adds a sleeper
 ├─ drift one mark, stamp it, emit MOVE
 ├─ roll:
 │   ├─ a sleeper moves      → build candidate → walls → WAKE
 │   ├─ an awake wallet adds → build candidate → walls → INFLOW / TRIM
 │   └─ otherwise            → CAST, walls re-run on open context
 └─ record flow for anything that cleared
```

Every emitted event carries `synthetic: true|false`. Cached and night modes are
always synthetic; live mode clears the flag only once market discovery actually
resolved. The flag rides along into the JSON output and into pellet exports, so
a screenshot and a file cannot disagree about where the numbers came from.

## Providers

| Module | Reads | On failure |
| --- | --- | --- |
| `providers/chain.mjs` | `eth_chainId`, `eth_blockNumber` | reports the error, never guesses a block |
| `providers/dex.mjs` | market discovery and per-token marks | returns `[]`, universe keeps its last marks |
| `providers/wallets.mjs` | tracked pool | falls back to the bootstrap pool and says so |

`providers/http.mjs` is the only place `fetch` is called. It applies a hard
timeout, does not retry, and never throws upward — every provider returns a
result object with an `error` field instead.

The wallet provider does not merge live and bootstrap rows. You are either
looking at the live pool or the bootstrap pool, and the header says which.

## Modules

```
bin/pellet.mjs              CLI entrypoint and subcommand table
src/config.mjs              chain, rules, palette, seed loader
src/core/walls.mjs          the walls — pure, no imports, shared with the site
src/cli/rules.mjs           CLI re-export of the walls
src/cli/runtime.mjs         universe, pool, flow window, tick loop
src/cli/render.mjs          full-screen frame composition
src/cli/terminal.mjs        raw-mode keyboard, redraw timer, restore on exit
src/cli/format.mjs          ANSI-aware padding, sparklines, units
src/providers/http.mjs      timeout-bounded fetch and JSON-RPC
src/providers/chain.mjs     chain health
src/providers/dex.mjs       market discovery and marks
src/providers/wallets.mjs   tracked wallet pool
src/services/state.mjs      atomic local state: rules and roost
src/services/pellet.mjs     wallet record construction and Markdown export
scripts/build-site.mjs      syncs the site's generated copies
server.mjs                  serves ./site plus a read-only JSON endpoint
site/                       landing page, docs, web terminal, self-hosted fonts
```

`src/core/walls.mjs` has no imports at all and does no I/O — not even a clock of
its own. That is deliberate twice over. The decision box is the part that has to
be auditable, so it is the part that is easiest to test in isolation; and being
dependency-free means the website can import the identical file. A verdict shown
in a browser is the verdict the terminal would print, because it is the same
code, not a port of it.

`scripts/build-site.mjs` copies that module and `data/seed.json` into `site/` so
the folder deploys on its own. Both copies carry a generated banner, and
`test/site.test.mjs` fails if either drifts from its source.

## Terminal restore

The terminal switches to the alternate screen buffer and hides the cursor. The
restore handler is idempotent and bound to `SIGINT` and `exit`, so a crash or a
`Ctrl-C` still returns a usable shell.
