# Commands

Every command runs without credentials. Nothing here signs, sends or holds keys.

## `pellet terminal`

| Flag | Effect |
| --- | --- |
| `--night` | high-cadence stream for recording and screenshares |
| `--live` | probe chain and market providers at boot |
| `--for <seconds>` | run for a fixed duration, then exit cleanly |

## `pellet wake`

The same engine without the full-screen renderer. Useful for a raw wall, a log
pipe, or JSON into something else.

| Flag | Effect |
| --- | --- |
| `--cast-only` | only rows that cleared every wall |
| `--json` | one JSON object per line |
| `--for <seconds>` | stop after a fixed duration |
| `--night` | faster cadence |

Refused rows print the wall that refused them on a second, indented line.

## `pellet flow`

Ranked smart-money desk for the current window.

| Flag | Default | Effect |
| --- | --- | --- |
| `--top <n>` | `12` | rows to print |
| `--ticks <n>` | `180` | how much session to build before ranking |
| `--json` | — | machine-readable output |

## `pellet sleepers`

Tracked wallets still past the `SLEEP` threshold, longest silence first.
Takes `--top` and `--json`.

## `pellet wallet <handle>`

One wallet read out: score, trades, win rate, median ticket, realized, dormancy,
what it was observed doing this session, and which wall refused it most often.

## `pellet cough <handle>`

Writes the pellet — the full record for one wallet.

| Flag | Default | Effect |
| --- | --- | --- |
| `--format md\|json` | `md` | output shape |
| `--output <file>` | stdout | write to a file; refuses to overwrite |
| `--ticks <n>` | `160` | session length to observe first |

## `pellet roost [add\|remove <handle>]`

Local watchlist, capped at `roostLimit`. With no arguments, prints the roost and
where it is stored.

## `pellet rules`

Prints the decision box. `--set key=value` writes one rule to local state:

```
pellet rules --set sleepDays=90
pellet rules --set maxImpact=0.015
pellet rules --set minFlowWallets=4
```

Valid keys: `sleepDays`, `minDna`, `sizeRatio`, `maxImpact`, `maxMarkAgeSec`,
`flowWindowMin`, `minFlowWallets`, `roostLimit`.

## `pellet doctor [--probe]`

RPC reachability, chain ID against the expected `4663`, head block, state
directory and whether a read credential is present. `--probe` additionally hits
the market and wallet providers and reports what came back.

## `pellet web`

Read-only browser mirror of the same runtime on `127.0.0.1`. No wallet connect.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `PELLET_RPC_URL` | public Robinhood Chain RPC | custom HTTP(S) provider |
| `REPLYNODES_API_KEY` | unset | optional wallet-activity read credential |
| `FOMO_BEARER_TOKEN` | unset | alternative read credential |
| `PELLET_DATA_DIR` | `./.pellet` | roost, rules and written pellets |
| `PORT` | `4721` | browser wrapper port |

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | completed, possibly with sections marked unavailable |
| `1` | bad input, unknown wallet, or a refused local write |
