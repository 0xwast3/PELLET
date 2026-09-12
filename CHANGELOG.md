# Changelog

## 0.5.0

- Brand pass: the mascot owl ships in `assets/`, and the terminal palette moved
  to 24-bit colour sampled from it. The 256-colour approximation of the lime was
  not the same green.
- README, docs and the browser mirror recoloured to match.
- Terminal, wake and flow captures are rendered from real ANSI output rather
  than drawn as mockups.
- The wake feed no longer prints the verdict twice on one row.

## 0.4.0

- `SLEEP` is reported as `N/A` on inflow candidates instead of being silently
  passed, so a wake and an add are never confused in the trace.
- Sleeper discovery added: the tracked pool grows during a session rather than
  draining as seeded wallets wake.
- Smart-flow desk gained a distinct-wallet floor; one wallet cycling a position
  no longer ranks.
- Trims subtract from the desk, so a token can rank negative.
- `pellet cough` writes the full wallet record to Markdown or JSON.
- Every event carries an explicit `synthetic` flag through the CLI, the web
  mirror and exported pellets.

## 0.3.0

- Two-pane terminal with the selected row's full wall trace.
- `pellet rules --set` writes rule changes to atomic local state.
- Optional read-only browser mirror on loopback.

## 0.2.0

- The five-wall decision box, with the first failing wall owning the refusal.
- Unknown inputs refuse with `UNKNOWN` instead of collapsing to zero.

## 0.1.0

- Bootstrap set, dormancy clock, wake events, scrolling feed.
