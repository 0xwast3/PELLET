import { createRuntime } from './runtime.mjs';
import { frame } from './render.mjs';
import { THEME as T } from '../config.mjs';
import { read as readState, toggleRoost } from '../services/state.mjs';
import { cough } from '../services/pellet.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from '../config.mjs';

const FILTERS = ['ALL', 'CAST', 'PASS', 'WAKE'];

export async function runTerminal(opts = {}) {
  const rt = createRuntime({ mode: opts.night ? 'night' : opts.live ? 'live' : 'cached' });
  rt.ui = {
    cursor: 0,
    filter: 'ALL',
    paused: false,
    roost: readState().roost,
    note: '',
    visibleEvents() {
      const all = rt.state.events;
      if (this.filter === 'ALL') return all;
      if (this.filter === 'WAKE') return all.filter((e) => e.type === 'WAKE');
      if (this.filter === 'CAST') return all.filter((e) => e.candidate?.decision?.cast);
      return all.filter((e) => e.candidate && !e.candidate.decision.cast);
    }
  };

  await rt.boot();

  const out = process.stdout;
  const cadence = opts.night ? 320 : 950;
  let frameNo = 0;
  let stopped = false;

  out.write('\u001b[?25l\u001b[?1049h');
  const restore = () => {
    if (stopped) return;
    stopped = true;
    out.write('\u001b[?1049l\u001b[?25h');
  };

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (key) => {
      const visible = rt.ui.visibleEvents();
      if (key === 'q' || key === '\u0003') { restore(); process.exit(0); }
      else if (key === '\u001b[A') rt.ui.cursor = Math.max(0, rt.ui.cursor - 1);
      else if (key === '\u001b[B') rt.ui.cursor = Math.min(Math.max(0, visible.length - 1), rt.ui.cursor + 1);
      else if (key === 'f') rt.ui.filter = FILTERS[(FILTERS.indexOf(rt.ui.filter) + 1) % FILTERS.length];
      else if (key === 'w') rt.ui.filter = rt.ui.filter === 'WAKE' ? 'ALL' : 'WAKE';
      else if (key === 'p') rt.ui.paused = !rt.ui.paused;
      else if (key === 'r') rt.pullMarkets().catch(() => {});
      else if (key === ' ') {
        const e = visible[rt.ui.cursor];
        if (e?.handle) rt.ui.roost = toggleRoost(e.handle, rt.state.rules.roostLimit).roost;
      } else if (key === 'c') {
        const e = visible[rt.ui.cursor];
        const wallet = e?.handle ? rt.state.wallets.get(e.handle) : null;
        if (wallet) {
          const p = cough(wallet, { events: rt.state.events, rules: rt.state.rules });
          mkdirSync(DATA_DIR, { recursive: true });
          const path = join(DATA_DIR, `pellet-${wallet.handle}-${Date.now()}.json`);
          writeFileSync(path, JSON.stringify(p, null, 2));
          rt.emit({ type: 'SYNC', handle: wallet.handle, line: `pellet written → ${path}` });
        }
      }
      draw();
    });
  }

  function draw() {
    const cols = Math.max(90, out.columns || 120);
    const rows = Math.max(24, out.rows || 34);
    out.write(`\u001b[H\u001b[2J${frame(rt, cols, rows, frameNo)}`);
  }

  draw();
  const timer = setInterval(() => {
    frameNo += 1;
    if (!rt.ui.paused) rt.tick();
    draw();
  }, cadence);

  if (opts.forSeconds) {
    setTimeout(() => { clearInterval(timer); restore(); process.exit(0); }, opts.forSeconds * 1000);
  }
  process.on('SIGINT', () => { clearInterval(timer); restore(); process.exit(0); });
  process.on('exit', restore);
}

export { FILTERS };
