import { evaluate, dormancyDays, DEFAULT_RULES } from './walls.js';

export { evaluate, dormancyDays, DEFAULT_RULES };

const MAX_EVENTS = 400;
const SPARK = 12;
const ETH_USD = 3100;

const HEAD = ['cold', 'low', 'dry', 'pale', 'long', 'slate', 'hoar', 'night', 'tin', 'grain', 'salt', 'iron'];
const TAIL = ['kiln', 'belfry', 'furrow', 'rookery', 'bittern', 'shutter', 'spindle', 'tallow',
  'lantern', 'chaff', 'brack', 'wicket', 'cellar', 'thresh', 'gable', 'sump'];

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export async function loadSeed(url = 'data/seed.json') {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`seed ${res.status}`);
  return res.json();
}

/**
 * Browser runtime.
 *
 * The same shape as the CLI runtime in src/cli/runtime.mjs: a growing token
 * universe, a tracked wallet pool with per-wallet dormancy, and a rolling flow
 * window. Every event it emits is marked synthetic, because on a static host
 * there is no chain to read.
 */
export function createEngine(seed, options = {}) {
  const rules = { ...DEFAULT_RULES, ...(options.rules || {}) };
  const rand = mulberry32(options.seedValue ?? (Date.now() & 0xffff));

  const state = {
    rules,
    synthetic: true,
    universe: new Map(),
    wallets: new Map(),
    events: [],
    flow: new Map(),
    counters: { wake: 0, inflow: 0, cast: 0, passed: 0, ticks: 0 }
  };

  for (const t of seed.tokens) state.universe.set(t.symbol, { ...t, markedAt: Date.now() });
  for (const w of seed.wallets) state.wallets.set(w.handle, { ...w, wakes: 0, touched: [] });

  const pick = (list) => list[Math.floor(rand() * list.length)];

  function emit(event) {
    const full = { id: state.events.length + 1, at: Date.now(), synthetic: true, ...event };
    state.events.unshift(full);
    if (state.events.length > MAX_EVENTS) state.events.length = MAX_EVENTS;
    return full;
  }

  function recordFlow(symbol, usd, handle) {
    const cur = state.flow.get(symbol) || { symbol, netUsd: 0, wallets: new Set(), tickets: 0, spark: [] };
    cur.netUsd += usd;
    cur.wallets.add(handle);
    cur.tickets += 1;
    cur.spark.push(cur.netUsd);
    if (cur.spark.length > SPARK) cur.spark.shift();
    state.flow.set(symbol, cur);
  }

  function discoverSleeper() {
    let handle = null;
    for (let i = 0; i < 24 && !handle; i += 1) {
      const c = `${pick(HEAD)}_${pick(TAIL)}`;
      if (!state.wallets.has(c)) handle = c;
    }
    if (!handle) return null;
    const days = Math.floor(rules.sleepDays + rand() * 520);
    const wallet = {
      handle,
      address: '0x' + Array.from({ length: 40 }, () => '0123456789abcdef'[Math.floor(rand() * 16)]).join(''),
      dna: Math.floor(40 + rand() * 52),
      trades: Math.floor(28 + rand() * 420),
      winRate: Number((0.26 + rand() * 0.36).toFixed(3)),
      medianTicketEth: Number((0.05 + rand() * 2.2).toFixed(3)),
      realizedEth: Number((-12 + rand() * 320).toFixed(2)),
      lastActive: new Date(Date.now() - days * 86400000).toISOString(),
      tags: [], wakes: 0, touched: []
    };
    state.wallets.set(handle, wallet);
    emit({ type: 'FOUND', handle, line: `sleeper · silent ${days}d · DNA ${wallet.dna}` });
    return wallet;
  }

  function candidate(wallet, token, kind) {
    const ticketEth = Number((wallet.medianTicketEth * (0.2 + rand() * 2.6)).toFixed(3));
    const ticketUsd = ticketEth * ETH_USD;
    const markAgeSec = (Date.now() - token.markedAt) / 1000;
    const cand = { wallet, token, ticketEth, ticketUsd, markAgeSec, kind };
    return { ...cand, decision: evaluate(cand, rules) };
  }

  function tick() {
    state.counters.ticks += 1;
    if (state.counters.ticks % 3 === 0) discoverSleeper();

    const tokens = [...state.universe.values()];
    const wallets = [...state.wallets.values()];
    const out = [];

    const moved = pick(tokens);
    const drift = (rand() - 0.46) * 0.14;
    moved.priceUsd = Math.max(1e-8, moved.priceUsd * (1 + drift));
    moved.markedAt = Date.now();
    out.push(emit({ type: 'MOVE', symbol: moved.symbol,
      line: `${drift >= 0 ? '+' : ''}${(drift * 100).toFixed(2)}% → $${moved.priceUsd.toPrecision(3)}` }));

    const sleepers = wallets.filter((w) => (dormancyDays(w) ?? 0) >= rules.sleepDays);
    const awake = wallets.filter((w) => (dormancyDays(w) ?? 0) < rules.sleepDays);
    const roll = rand();

    if (roll < 0.36 && sleepers.length) {
      const wallet = pick(sleepers);
      const token = pick(tokens);
      const days = dormancyDays(wallet);
      const c = candidate(wallet, token, 'WAKE');
      wallet.wakes += 1;
      wallet.touched = [token.symbol, ...wallet.touched].slice(0, 10);
      wallet.lastActive = new Date().toISOString();
      state.counters.wake += 1;
      if (c.decision.cast) { state.counters.cast += 1; recordFlow(token.symbol, c.ticketUsd, wallet.handle); }
      else state.counters.passed += 1;
      out.push(emit({ type: 'WAKE', symbol: token.symbol, handle: wallet.handle, candidate: c, dormancy: days,
        line: `asleep ${days.toFixed(0)}d → ${c.ticketEth} ETH · ${c.decision.cast ? 'CAST' : 'PASS'}` }));
    } else if (roll < 0.74 && awake.length) {
      const wallet = pick(awake);
      const token = pick(tokens);
      const c = candidate(wallet, token, 'INFLOW');
      wallet.touched = [token.symbol, ...wallet.touched].slice(0, 10);
      if (rand() < 0.28) {
        recordFlow(token.symbol, -c.ticketUsd, wallet.handle);
        out.push(emit({ type: 'TRIM', symbol: token.symbol, handle: wallet.handle, candidate: c,
          line: `cut ${c.ticketEth} ETH` }));
      } else {
        state.counters.inflow += 1;
        if (c.decision.cast) { state.counters.cast += 1; recordFlow(token.symbol, c.ticketUsd, wallet.handle); }
        else state.counters.passed += 1;
        out.push(emit({ type: 'INFLOW', symbol: token.symbol, handle: wallet.handle, candidate: c,
          line: `add ${c.ticketEth} ETH · ${c.decision.cast ? 'CAST' : 'PASS'}` }));
      }
    } else {
      out.push(emit({ type: 'CAST', symbol: pick(tokens).symbol, line: 'walls re-run on open context' }));
    }
    return out;
  }

  const desk = (limit = 8) => [...state.flow.values()]
    .filter((r) => r.wallets.size >= rules.minFlowWallets)
    .map((r) => ({ symbol: r.symbol, netUsd: r.netUsd, wallets: r.wallets.size, tickets: r.tickets,
      avgUsd: r.netUsd / Math.max(1, r.tickets), spark: [...r.spark] }))
    .sort((a, b) => b.netUsd - a.netUsd)
    .slice(0, limit);

  const sleepers = (limit = 10) => [...state.wallets.values()]
    .map((w) => ({ ...w, days: dormancyDays(w) ?? 0 }))
    .filter((w) => w.days >= rules.sleepDays)
    .sort((a, b) => b.days - a.days)
    .slice(0, limit);

  /** The pellet: one wallet, brought back up whole. */
  function cough(handle) {
    const wallet = state.wallets.get(handle);
    if (!wallet) return null;
    const mine = state.events.filter((e) => e.handle === handle);
    const refused = mine.filter((e) => e.candidate && !e.candidate.decision.cast);
    const byWall = {};
    for (const e of refused) {
      const w = e.candidate.decision.failed;
      if (w) byWall[w] = (byWall[w] || 0) + 1;
    }
    return {
      wallet,
      dormancyDays: dormancyDays(wallet),
      observed: {
        events: mine.length,
        wakes: mine.filter((e) => e.type === 'WAKE').length,
        cast: mine.filter((e) => e.candidate?.decision?.cast).length,
        refused: refused.length,
        refusedBy: byWall
      },
      trail: mine.slice(0, 8)
    };
  }

  return { state, tick, desk, sleepers, cough, emit, discoverSleeper };
}

export const fmt = {
  usd(v) {
    if (!Number.isFinite(v)) return 'unknown';
    const a = Math.abs(v), s = v < 0 ? '-' : '';
    if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
    if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}k`;
    return `${s}$${a.toFixed(0)}`;
  },
  clock: (ts) => new Date(ts).toTimeString().slice(0, 8),
  spark(values) {
    const B = '▁▂▃▄▅▆▇█';
    if (!values || values.length < 2) return '·'.repeat(6);
    const lo = Math.min(...values), hi = Math.max(...values);
    if (hi === lo) return B[3].repeat(values.length);
    return values.map((v) => B[Math.round(((v - lo) / (hi - lo)) * 7)]).join('');
  }
};
