# Terminal

```
pellet terminal
pellet terminal --night     # high-cadence, for recording and screenshares
pellet terminal --live      # attempt live market and chain reads at boot
pellet terminal --for 120   # run for 120 seconds then exit cleanly
```

## Layout

![pellet terminal](../assets/terminal.png)

```
(o,o) PELLET wake terminal            CACHED·SYNTHETIC │ chain 4663 │ wake 22 cast 17 pass 28

── STREAM · 164 ──────────────────────────────────── │ ── SELECTED ─────────────────────
▌WAKE   @slate_shutter  $CASHCAT  asleep 536d → 1.2  │ WAKE 02:14:04Z
 MOVE   $GIZZARD                  -3.07% → $0.0793   │ wallet  @slate_shutter
 INFLOW @vesper         $SEDGE    add 3.45 ETH · CA  │ token   $CASHCAT
 FOUND  @long_rookery             tracked sleeper    │
 TRIM   @longsleep      $TALON    cut 2.86 ETH       │ ── WALLS ────────────────────────
                                                     │ ✓ SLEEP  536d        >= 45d
                                                     │ ✓ EDGE   76          >= 55
                                                     │ ✓ SIZE   1.204 ETH   >= 0.090 ETH
                                                     │ ✗ DEPTH  4.11%       <= 3.00%
                                                     │ ✓ PRICE  12s         <= 900s
                                                     │
                                                     │ PASS  DEPTH 4.11% · needs <= 3.00%
── SMART FLOW · 60m window ──────────────────────────────────────────────────────────────
TOKEN           NET FLOW   WALLETS        AVG  TREND
$SEDGE            $53.1k         8      $6.6k  ▁▃▂▃▄▅▇█
$MOLT             $52.6k         9      $5.8k  ▁▁▂▃▅▆███
```

Three things stay on screen at once: the stream, the reasoning for the selected
row, and the desk. Nothing you need to make a call lives behind a keystroke.

## Events

| Event | Meaning |
| --- | --- |
| `WAKE` | a wallet past the `SLEEP` threshold signed something |
| `FOUND` | a new sleeper crossed the threshold and entered the pool |
| `INFLOW` | a tracked wallet that was already awake added size |
| `TRIM` | a tracked wallet reduced a position; subtracts from the desk |
| `NEW` | a fresh market entered the universe |
| `MOVE` | a live mark changed |
| `CAST` | the walls were re-run against open context |
| `SYNC` | a provider refresh or a local write completed |

## Keys

```
↑ / ↓    move through the stream
f        cycle ALL → CAST → PASS → WAKE
w        jump straight to the wake filter and back
space    roost / unroost the selected wallet
c        cough a pellet for the selected wallet into the data directory
p        pause / resume the scanner
r        refresh market providers now
q        quit
```

## The header

The owl blinks on alternate frames. If it stops blinking, the stream is paused.

`CACHED·SYNTHETIC` in yellow means the rows are generated from the bootstrap set
rather than a live read — it is never hidden, and every event carries the same
flag in its JSON. `LIVE` in green means markets resolved. The chain segment
shows the chain ID actually returned by the RPC, not the one expected.

## Sizing

The renderer needs at least 90 columns and 24 rows. Below that it clips rather
than reflows, on the assumption that a clipped column is easier to read than a
rearranged one.
