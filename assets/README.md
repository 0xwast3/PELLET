# Brand assets

| File | Size | Use |
| --- | --- | --- |
| `avatar.png` | 1024×1024, transparent | the owl alone, for overlays and the README |
| `avatar-background.png` | 1024×1024 | GitHub and X profile picture |
| `banner.png` | 1280×640 | README header |
| `social-card.png` | 1200×630 | Open Graph and Twitter card |
| `terminal.png` | capture | `pellet terminal` |
| `flow.png` | capture | `pellet flow --top 10` |
| `wake.png` | capture | `pellet wake --night` |
| `how-it-works.svg` | vector | the wake → walls → desk pipeline |

The three captures are real terminal output, rendered from ANSI at the same
palette the CLI emits. They are not mockups. Regenerating them means re-running
the command and re-rendering, not editing an image.

## Palette

Sampled from the mascot, and the same values the CLI writes as 24-bit ANSI.

| Token | Hex | Where |
| --- | --- | --- |
| ink | `#050703` | background |
| panel | `#0e1408` | panels and hovered rows |
| line | `#1d2612` | borders and rules |
| lime | `#c9f92c` | wordmark, wakes, the owl |
| glow | `#f0fc2b` | eyes, beak, feet, synthetic flag |
| bone | `#dee8cd` | body text and wallet handles |
| dim | `#7a8668` | labels and secondary text |
| good | `#7ee081` | cleared walls, positive flow |
| bad | `#ff5f52` | refused walls, negative flow |

## Type

| Role | Face |
| --- | --- |
| wordmark | Pixelify Sans Medium |
| everything else | the terminal's own monospace; DejaVu Sans Mono in the captures |

## The owl

Pixel art, front-facing, readable at 32×32: two large round eyes with yellow
rings, small triangular tufts, a heavy black outline, four spots on the chest and
two yellow feet. Half-lidded — it has been awake a long time and is not impressed
by anything it has seen.

The same owl lives in the terminal header as six characters, `(o,o)`, and blinks
to `(-,-)` on alternate frames. If it stops blinking, the stream is paused. Any
future artwork has to keep those two states legible.
