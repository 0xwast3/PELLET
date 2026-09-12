import { loadSeed, DEFAULT_RULES } from '../config.mjs';
import { evaluate, dormancyDays } from './rules.mjs';
import * as dex from '../providers/dex.mjs';
import * as chain from '../providers/chain.mjs';
import * as walletSource from '../providers/wallets.mjs';
import { read as readState } from '../services/state.mjs';

const MAX_EVENTS = 600;
const SPARK = 12;

/** Word stock the discovery pass draws handles from as the session grows. */
const HANDLE_HEAD = ['cold', 'low', 'dry', 'pale', 'long', 'slate', 'hoar', 'night', 'tin', 'grain', 'salt', 'iron'];
const HANDLE_TAIL = ['kiln', 'belfry', 'furrow', 'rookery', 'bittern', 'shutter', 'spindle', 'tallow',
  'lantern', 'chaff', 'brack', 'wicket', 'cellar', 'thresh', 'gable', 'sump'];

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * The PELLET runtime.
 *
 * One process holds three things: a growing token universe, a tracked wallet
 * pool with per-wallet dormancy, and a rolling smart-flow window. Every tick
 * emits events, re-marks open context, and re-runs the walls on live candidates.
 */
export function createRuntime(options = {}) {
  const seed = loadSeed();
  const rules = { ...DEFAULT_RULES, ...readState().rules, ...(options.rules || {}) };
  const rand = mulberry32(options.seedValue ?? 0x9E3779B9);

  const state = {
    mode: options.mode || 'cached',
    synthetic: options.mode !== 'live',
    startedAt: Date.now(),
    now: options.now ?? Date.now(),
    rules,
    chain: { reachable: null, chainId: null, block: null, error: 'not probed' },
    walletSource: 'bootstrap',
    marketSource: 'bootstrap',
    universe: new Map(),
    wallets: new Map(),
    events: [],
    flow: new Map(),
    counters: { wake: 0, inflow: 0, cast: 0, passed: 0, ticks: 0 },
    lastError: null
  };

  for (const t of seed.tokens) state.universe.set(t.symbol, { ...t, markedAt: state.now });
  for (const w of seed.wallets) state.wallets.set(w.handle, { ...w, wakes: 0, touched: [] });

  const clock = () => (options.now ? state.now : Date.now());

  function emit(event) {
    const full = { id: state.events.length + 1, at: clock(), synthetic: state.synthetic, ...event };
    state.events.unshift(full);
    if (state.events.length > MAX_EVENTS) state.events.length = MAX_EVENTS;
    return full;
  }

  function pickWeighted(list) {
    return list[Math.floor(rand() * list.length)];
  }

  /**
   * Discovery pass. The tracked pool is not a frozen list: wallets keep
   * crossing the dormancy threshold, so the terminal keeps finding new
   * sleepers for as long as the session runs.
   */
  function discoverSleeper() {
    let handle = null;
    for (let attempt = 0; attempt < 24 && !handle; attempt += 1) {
      const c = `${HANDLE_HEAD[Math.floor(rand() * HANDLE_HEAD.length)]}_${HANDLE_TAIL[Math.floor(rand() * HANDLE_TAIL.length)]}`;
      if (!state.wallets.has(c)) handle = c;
    }
    if (!handle) return null;
    const days = Math.floor(state.rules.sleepDays + rand() * 520);
    const wallet = {
      handle,
      address: '0x' + Array.from({ length: 40 }, () => '0123456789abcdef'[Math.floor(rand() * 16)]).join(''),
      dna: Math.floor(40 + rand() * 52),
      trades: Math.floor(28 + rand() * 420),
      winRate: Number((0.26 + rand() * 0.36).toFixed(3)),
      medianTicketEth: Number((0.05 + rand() * 2.2).toFixed(3)),
      realizedEth: Number((-12 + rand() * 320).toFixed(2)),
      lastActive: new Date(clock() - days * 86400000).toISOString(),
      tags: [],
      wakes: 0,
      touched: []
    };
    state.wallets.set(handle, wallet);
    emit({ type: 'FOUND', handle, line: `sleeper · silent ${days}d · DNA ${wallet.dna}` });
    return wallet;
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

  /** Build a candidate out of a wallet touching a token, then run the walls. */
  function candidate(wallet, token, kind) {
    const ticketEth = Number((wallet.medianTicketEth * (0.2 + rand() * 2.6)).toFixed(3));
    const ethUsd = 3100;
    const ticketUsd = ticketEth * ethUsd;
    const markAgeSec = (clock() - token.markedAt) / 1000;
    const cand = { wallet, token, ticketEth, ticketUsd, markAgeSec, kind };
    const decision = evaluate(cand, state.rules, clock());
    return { ...cand, decision, ethUsd };
  }

  async function probeChain() {
    state.chain = await chain.health();
    return state.chain;
  }

  async function pullMarkets() {
    const res = await dex.discover('robinhood');
    if (!res.ok || res.tokens.length === 0) {
      state.lastError = res.error || 'no market rows';
      state.marketSource = 'bootstrap';
      return 0;
    }
    let added = 0;
    for (const t of res.tokens) {
      if (!t.symbol) continue;
      const known = state.universe.has(t.symbol);
      state.universe.set(t.symbol, { ...(state.universe.get(t.symbol) || {}), ...t, markedAt: Date.now() });
      if (!known) {
        added += 1;
        emit({ type: 'NEW', symbol: t.symbol, line: `fresh market · liq $${Math.round(t.liquidityUsd || 0).toLocaleString('en-US')}` });
      }
    }
    state.marketSource = 'live';
    return added;
  }

  async function pullWallets() {
    const res = await walletSource.pool();
    state.walletSource = res.source;
    if (!res.ok) state.lastError = res.error;
    for (const w of res.wallets) {
      const prev = state.wallets.get(w.handle);
      state.wallets.set(w.handle, { ...(prev || { wakes: 0, touched: [] }), ...w });
    }
    return res.wallets.length;
  }

  async function boot() {
    if (state.mode === 'live') {
      await Promise.all([probeChain(), pullMarkets(), pullWallets()]);
      state.synthetic = state.marketSource !== 'live';
    } else {
      await pullWallets();
    }
    emit({
      type: 'SYNC',
      line: `${state.mode.toUpperCase()} · markets ${state.marketSource} · wallets ${state.walletSource}` +
        (state.synthetic ? ' · synthetic stream' : '')
    });
    return state;
  }

  /** One tick. Advances marks, may wake a sleeper, may record inflow. */
  function tick() {
    state.counters.ticks += 1;
    if (options.now) state.now += 12000;
    const tokens = [...state.universe.values()];
    const wallets = [...state.wallets.values()];
    if (tokens.length === 0 || wallets.length === 0) return [];
    const out = [];

    if (state.counters.ticks % 3 === 0) discoverSleeper();

    // marks drift
    const moved = pickWeighted(tokens);
    const drift = (rand() - 0.46) * 0.14;
    moved.priceUsd = Math.max(1e-8, moved.priceUsd * (1 + drift));
    moved.markedAt = clock();
    out.push(emit({
      type: 'MOVE', symbol: moved.symbol,
      line: `${drift >= 0 ? '+' : ''}${(drift * 100).toFixed(2)}% → $${moved.priceUsd.toPrecision(3)}`
    }));

    const sleepers = wallets.filter((w) => (dormancyDays(w, clock()) ?? 0) >= state.rules.sleepDays);
    const awake = wallets.filter((w) => (dormancyDays(w, clock()) ?? 0) < state.rules.sleepDays);

    const roll = rand();
    if (roll < 0.34 && sleepers.length) {
      const wallet = pickWeighted(sleepers);
      const token = pickWeighted(tokens);
      const days = dormancyDays(wallet, clock());
      const c = candidate(wallet, token, 'WAKE');
      wallet.wakes += 1;
      wallet.touched = [token.symbol, ...wallet.touched].slice(0, 10);
      wallet.lastActive = new Date(clock()).toISOString();
      state.counters.wake += 1;
      if (c.decision.cast) { state.counters.cast += 1; recordFlow(token.symbol, c.ticketUsd, wallet.handle); }
      else state.counters.passed += 1;
      out.push(emit({
        type: 'WAKE', symbol: token.symbol, handle: wallet.handle, candidate: c,
        line: `asleep ${days.toFixed(0)}d → ${c.ticketEth} ETH · ${c.decision.cast ? 'CAST' : 'PASS'}`
      }));
    } else if (roll < 0.72 && awake.length) {
      const wallet = pickWeighted(awake);
      const token = pickWeighted(tokens);
      const c = candidate(wallet, token, 'INFLOW');
      wallet.touched = [token.symbol, ...wallet.touched].slice(0, 10);
      const trimming = rand() < 0.28;
      if (trimming) {
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
      const token = pickWeighted(tokens);
      out.push(emit({ type: 'CAST', symbol: token.symbol, line: 'walls re-run on open context' }));
    }
    return out;
  }

  /** Ranked smart-flow desk for the current window. */
  function desk(limit = 8) {
    return [...state.flow.values()]
      .filter((r) => r.wallets.size >= state.rules.minFlowWallets)
      .map((r) => ({
        symbol: r.symbol,
        netUsd: r.netUsd,
        wallets: r.wallets.size,
        tickets: r.tickets,
        avgUsd: r.netUsd / Math.max(1, r.tickets),
        spark: [...r.spark]
      }))
      .sort((a, b) => b.netUsd - a.netUsd)
      .slice(0, limit);
  }

  function sleepers(limit = 12) {
    return [...state.wallets.values()]
      .map((w) => ({ ...w, days: dormancyDays(w, clock()) ?? 0 }))
      .filter((w) => w.days >= state.rules.sleepDays)
      .sort((a, b) => b.days - a.days)
      .slice(0, limit);
  }

  return { state, boot, tick, desk, sleepers, discoverSleeper, probeChain, pullMarkets, pullWallets, emit };
}
