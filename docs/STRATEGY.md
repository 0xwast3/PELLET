# Strategy

## The question PELLET answers

Two questions, one screen.

1. Which wallet that had gone quiet has just moved?
2. Where did money from wallets with a record actually go in the last hour?

A wake on its own is noise. A flow number on its own is a popularity contest.
Together they say something narrower: *this specific dormant wallet came back,
and here is whether anyone else with a record is standing in the same place.*

## Why dormancy is the filter

An active wallet trades constantly, so any one of its entries carries almost no
information. A wallet that has been silent for a year and then signs something
has made a decision, not a habit. The silence is the signal, and it is cheap to
measure: one timestamp per wallet.

The `SLEEP` threshold is a dial, not a truth. Forty-five days is the default
because it is long enough to exclude a normal trading rhythm and short enough
that the pool does not empty. Move it with `pellet rules --set sleepDays=90`.

## The walls

A score is context. Permission is a sequence of walls, evaluated in order, and
the first one that fails owns the refusal.

| Wall | Default | What it asks |
| --- | --- | --- |
| `SLEEP` | `>= 45d` | was this wallet actually silent, or just slow? |
| `EDGE` | `DNA >= 55` | does the wallet have a record worth reading? |
| `SIZE` | `>= 0.35x median` | is this a real ticket for *this* wallet? |
| `DEPTH` | `<= 3.00%` | is the pool deep enough to absorb that ticket? |
| `PRICE` | `<= 900s` | is there a fresh mark to read the entry against? |

```
tracked wallet
    ↓
dormancy crosses SLEEP
    ↓
SLEEP → EDGE → SIZE → DEPTH → PRICE
    ↓
CAST / PASS + the wall that refused
    ↓
smart-flow desk · roost · pellet export
```

### SIZE is relative, on purpose

A 4 ETH ticket is enormous for a wallet whose median is 0.05 and unremarkable
for one whose median is 6. Absolute thresholds tell you which wallets are rich.
Relative thresholds tell you which wallets are serious.

### `SLEEP` does not apply to everything

An inflow from a wallet that never went quiet is still worth ranking on the
desk, but it is not a wake. Rather than passing `SLEEP` silently, the trace
records it as `N/A`. You always know which of the two you are looking at.

### Unknown is not zero

If liquidity cannot be read, `DEPTH` returns `UNKNOWN` and the candidate is
refused. It does not quietly become `0%` and pass. Every refusal names its wall,
including the ones caused by missing data.

## The flow desk

Inside a rolling window the desk keeps, per token: net USD in minus out, the
number of *distinct* tracked wallets involved, ticket count, average ticket and
a cumulative sparkline.

Net flow is the headline, but the wallet count is the guard. One wallet cycling
the same position eight times produces a large number and means nothing, so a
token does not rank until at least `minFlowWallets` distinct wallets have
touched it. Reductions subtract. A token can rank negative, and that is a
result, not a gap.

## What this is not

PELLET does not price anything, rate safety, predict direction, place orders or
hold keys. It reads public state and prints what it read, with the reasoning
attached. Every number on the screen should be traceable to either a chain read,
a market read, or the bootstrap set — and the header tells you which.
