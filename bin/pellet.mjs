#!/usr/bin/env node
import { createRuntime } from '../src/cli/runtime.mjs';
import { runTerminal } from '../src/cli/terminal.mjs';
import { ruleSheet } from '../src/cli/rules.mjs';
import { cough, toMarkdown } from '../src/services/pellet.mjs';
import { read as readState, write as writeState, toggleRoost } from '../src/services/state.mjs';
import { THEME as T, CHAIN, DATA_DIR } from '../src/config.mjs';
import { usd, spark, pad, verdictTag } from '../src/cli/format.mjs';
import * as chain from '../src/providers/chain.mjs';
import * as dex from '../src/providers/dex.mjs';
import * as walletSource from '../src/providers/wallets.mjs';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const cmd = argv[0] || 'help';
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const p = (s = '') => process.stdout.write(s + '\n');

async function warmRuntime(ticks = 140) {
  const rt = createRuntime({ mode: flag('live') ? 'live' : 'cached' });
  await rt.boot();
  for (let i = 0; i < ticks; i += 1) rt.tick();
  return rt;
}

const commands = {
  async terminal() {
    await runTerminal({
      night: flag('night'),
      live: flag('live'),
      forSeconds: value('for') ? Number(value('for')) : null
    });
  },

  /** Scrolling wake feed. No renderer, pipeable. */
  async wake() {
    const rt = createRuntime({ mode: flag('live') ? 'live' : 'cached' });
    await rt.boot();
    const castOnly = flag('cast-only');
    const json = flag('json');
    const until = value('for') ? Date.now() + Number(value('for')) * 1000 : null;
    if (!json) p(`${T.lime}PELLET${T.reset} ${T.dim}wake feed · ${rt.state.mode}${rt.state.synthetic ? ' · synthetic' : ''}${T.reset}`);
    const timer = setInterval(() => {
      for (const e of rt.tick()) {
        if (e.type !== 'WAKE' && e.type !== 'FOUND') continue;
        if (castOnly && !e.candidate?.decision?.cast) continue;
        if (json) { p(JSON.stringify(e)); continue; }
        const v = e.candidate ? verdictTag(e.candidate.decision.verdict) : `${T.dim}—${T.reset}`;
        p(`${T.dim}${new Date(e.at).toISOString().slice(11, 19)}${T.reset} ${T.lime}${pad(e.type, 6)}${T.reset} ${T.bone}${pad('@' + e.handle, 18)}${T.reset}${pad(e.symbol ? '$' + e.symbol : '', 11)} ${v}  ${T.dim}${e.line.replace(/ · (CAST|PASS)$/, '')}${T.reset}`);
        if (e.candidate && !e.candidate.decision.cast) p(`${' '.repeat(9)}${T.dark}└ ${e.candidate.decision.reason}${T.reset}`);
      }
      if (until && Date.now() > until) { clearInterval(timer); process.exit(0); }
    }, flag('night') ? 260 : 800);
  },

  /** Ranked smart-money desk for the current window. */
  async flow() {
    const rt = await warmRuntime(Number(value('ticks', '180')));
    const rows = rt.desk(Number(value('top', '12')));
    if (flag('json')) return p(JSON.stringify(rows, null, 2));
    p('');
    p(`${T.lime}SMART FLOW${T.reset} ${T.dim}· ${rt.state.rules.flowWindowMin}m window · min ${rt.state.rules.minFlowWallets} wallets${rt.state.synthetic ? ' · synthetic' : ''}${T.reset}`);
    p('');
    p(`${T.dark}${pad('TOKEN', 12)}${pad('NET FLOW', 12)}${pad('WALLETS', 9)}${pad('TICKETS', 9)}${pad('AVG', 11)}TREND${T.reset}`);
    for (const r of rows) {
      const c = r.netUsd >= 0 ? T.good : T.bad;
      p(`${T.bone}${pad('$' + r.symbol, 12)}${T.reset}${c}${pad(usd(r.netUsd), 12)}${T.reset}${pad(String(r.wallets), 9)}${pad(String(r.tickets), 9)}${T.dim}${pad(usd(r.avgUsd), 11)}${T.reset}${c}${spark(r.spark)}${T.reset}`);
    }
    if (rows.length === 0) p(`${T.dim}nothing cleared the wallet floor in this window${T.reset}`);
    p('');
  },

  /** Who is still asleep, longest first. */
  async sleepers() {
    const rt = await warmRuntime(Number(value('ticks', '120')));
    const rows = rt.sleepers(Number(value('top', '15')));
    if (flag('json')) return p(JSON.stringify(rows, null, 2));
    p('');
    p(`${T.lime}SLEEPERS${T.reset} ${T.dim}· silent >= ${rt.state.rules.sleepDays}d${T.reset}`);
    p('');
    p(`${T.dark}${pad('WALLET', 20)}${pad('ASLEEP', 10)}${pad('DNA', 6)}${pad('WR', 7)}${pad('MEDIAN', 12)}REALIZED${T.reset}`);
    for (const w of rows) {
      p(`${T.bone}${pad('@' + w.handle, 20)}${T.reset}${T.lime}${pad(w.days.toFixed(0) + 'd', 10)}${T.reset}${pad(String(w.dna), 6)}${pad(((w.winRate || 0) * 100).toFixed(0) + '%', 7)}${pad(w.medianTicketEth + ' ETH', 12)}${T.dim}${w.realizedEth} ETH${T.reset}`);
    }
    p('');
  },

  /** One wallet, read out loud. */
  async wallet() {
    const handle = argv[1];
    if (!handle) return fail('usage: pellet wallet <handle>');
    const rt = await warmRuntime(Number(value('ticks', '160')));
    const w = rt.state.wallets.get(handle.replace(/^@/, ''));
    if (!w) return fail(`unknown wallet "${handle}" · try: pellet sleepers`);
    const rec = cough(w, { events: rt.state.events, rules: rt.state.rules });
    if (flag('json')) return p(JSON.stringify(rec, null, 2));
    p('');
    p(`${T.lime}@${w.handle}${T.reset}  ${T.dim}${w.address}${T.reset}`);
    p(`${T.dark}${'─'.repeat(66)}${T.reset}`);
    p(`${T.dim}dna${T.reset} ${w.dna}   ${T.dim}trades${T.reset} ${w.trades}   ${T.dim}win rate${T.reset} ${((w.winRate || 0) * 100).toFixed(0)}%   ${T.dim}median${T.reset} ${w.medianTicketEth} ETH`);
    p(`${T.dim}realized${T.reset} ${w.realizedEth} ETH   ${T.dim}dormancy${T.reset} ${rec.sleep.dormancyDays}d   ${T.dim}sleeping${T.reset} ${rec.sleep.sleeping ? 'yes' : 'no'}`);
    p('');
    p(`${T.dim}observed this session${T.reset}  ${rec.observed.events} events · ${rec.observed.wakes} wakes · ${T.good}${rec.observed.cast} cast${T.reset} · ${T.bad}${rec.observed.refused} refused${T.reset}`);
    const by = Object.entries(rec.observed.refusedBy);
    if (by.length) p(`${T.dim}refused by${T.reset}  ${by.map(([k, v]) => `${k}×${v}`).join('  ')}`);
    p(`${T.dim}touched${T.reset}  ${(w.touched || []).map((s) => '$' + s).join(' ') || '—'}`);
    p('');
  },

  /** Write the pellet: the readable record of one wallet. */
  async cough() {
    const handle = argv[1];
    if (!handle) return fail('usage: pellet cough <handle> [--format json|md] [--output file]');
    const rt = await warmRuntime(Number(value('ticks', '160')));
    const w = rt.state.wallets.get(handle.replace(/^@/, ''));
    if (!w) return fail(`unknown wallet "${handle}"`);
    const rec = cough(w, { events: rt.state.events, rules: rt.state.rules });
    const format = value('format', 'md');
    const body = format === 'json' ? JSON.stringify(rec, null, 2) : toMarkdown(rec);
    const out = value('output');
    if (!out) return p(body);
    if (existsSync(out)) return fail(`refusing to overwrite ${out}`);
    writeFileSync(out, body);
    p(`${T.good}written${T.reset} ${out}`);
  },

  /** Local watchlist. */
  async roost() {
    const sub = argv[1];
    if (!sub) {
      const state = readState();
      p('');
      p(`${T.lime}ROOST${T.reset} ${T.dim}· ${state.roost.length}/${state.rules.roostLimit} · ${DATA_DIR}${T.reset}`);
      for (const h of state.roost) p(`  ${T.bone}@${h}${T.reset}`);
      if (!state.roost.length) p(`  ${T.dim}empty · add one with: pellet roost add <handle>${T.reset}`);
      return p('');
    }
    const handle = argv[2]?.replace(/^@/, '');
    if (!handle) return fail('usage: pellet roost <add|remove> <handle>');
    const res = toggleRoost(handle, readState().rules.roostLimit);
    p(res.roosted ? `${T.good}roosted${T.reset} @${handle}` : `${T.dim}removed${T.reset} @${handle}`);
  },

  /** Current decision box. */
  async rules() {
    const state = readState();
    p('');
    p(`${T.lime}PELLET WALLS${T.reset}`);
    p('');
    for (const [name, want, ask] of ruleSheet(state.rules)) {
      p(`  ${T.bone}${pad(name, 8)}${T.reset}${T.lime}${pad(want, 20)}${T.reset}${T.dim}${ask}${T.reset}`);
    }
    p('');
    p(`  ${T.dim}flow window${T.reset} ${state.rules.flowWindowMin}m   ${T.dim}min wallets${T.reset} ${state.rules.minFlowWallets}   ${T.dim}roost limit${T.reset} ${state.rules.roostLimit}`);
    p(`  ${T.dim}state${T.reset} ${DATA_DIR}`);
    p('');
    if (value('set')) {
      const [k, v] = String(value('set')).split('=');
      if (!(k in state.rules)) return fail(`unknown rule "${k}"`);
      state.rules[k] = Number(v);
      writeState(state);
      p(`${T.good}set${T.reset} ${k} = ${state.rules[k]}`);
    }
  },

  /** Provider and chain health. Says what it could not read. */
  async doctor() {
    p('');
    p(`${T.lime}PELLET doctor${T.reset}`);
    p('');
    const h = await chain.health();
    line('rpc', h.url);
    line('chain', h.reachable ? `${h.chainId} ${h.matches ? '(matches ' + CHAIN.id + ')' : T.bad + '(expected ' + CHAIN.id + ')' + T.reset}` : `${T.bad}unreachable · ${h.error}${T.reset}`);
    line('block', h.block ?? `${T.dim}unknown${T.reset}`);
    if (flag('probe')) {
      const d = await dex.discover('robinhood');
      line('markets', d.ok ? `${T.good}${d.tokens.length} rows${T.reset}` : `${T.bad}${d.error}${T.reset}`);
      const w = await walletSource.pool();
      line('wallets', `${w.wallets.length} · source ${w.source}${w.error ? ` ${T.bad}(${w.error})${T.reset}` : ''}`);
    } else {
      line('markets', `${T.dim}skipped · add --probe${T.reset}`);
    }
    line('state', existsSync(join(DATA_DIR, 'runtime.json')) ? DATA_DIR : `${T.dim}${DATA_DIR} (not created yet)${T.reset}`);
    line('creds', process.env.REPLYNODES_API_KEY || process.env.FOMO_BEARER_TOKEN ? `${T.good}present${T.reset}` : `${T.dim}none · public mode${T.reset}`);
    p('');
  },

  async web() {
    await import('../server.mjs');
  },

  async help() {
    p(`
${T.lime}PELLET${T.reset} ${T.dim}· wake terminal for ${CHAIN.name}${T.reset}

  ${T.bone}pellet terminal${T.reset} [--night] [--live] [--for n]   two-pane live terminal
  ${T.bone}pellet wake${T.reset} [--cast-only] [--json] [--for n]   scrolling wake feed
  ${T.bone}pellet flow${T.reset} [--top n] [--json]                 ranked smart-money desk
  ${T.bone}pellet sleepers${T.reset} [--top n]                      who is still silent
  ${T.bone}pellet wallet${T.reset} <handle>                         one wallet, read out
  ${T.bone}pellet cough${T.reset} <handle> [--format md|json]       write the pellet
  ${T.bone}pellet roost${T.reset} [add|remove <handle>]             local watchlist
  ${T.bone}pellet rules${T.reset} [--set key=value]                 the decision box
  ${T.bone}pellet doctor${T.reset} [--probe]                        provider health
  ${T.bone}pellet web${T.reset}                                     optional browser wrapper

${T.dim}Docs: docs/TERMINAL.md · docs/STRATEGY.md · docs/COMMANDS.md${T.reset}
`);
  }
};

function line(k, v) { p(`  ${T.dim}${pad(k, 10)}${T.reset}${v}`); }
function fail(msg) { process.stderr.write(`${T.bad}${msg}${T.reset}\n`); process.exitCode = 1; }

const run = commands[cmd] || commands.help;
run().catch((err) => { fail(err?.message || String(err)); });
