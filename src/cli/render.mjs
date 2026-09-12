import { THEME as T } from '../config.mjs';
import { pad, clip, spark, usd, ago, width, EVENT_COLOR, verdictTag } from './format.mjs';
import { ruleSheet } from './rules.mjs';

const H = '─', V = '│';

function rule(n, label = '') {
  if (!label) return T.dark + H.repeat(n) + T.reset;
  const head = `${H}${H} ${label} `;
  return T.dark + head + H.repeat(Math.max(0, n - width(head))) + T.reset;
}

/**
 * Header: wordmark, mode, chain, counters. The owl sits on the left and
 * blinks on every other frame so a paused stream is visible at a glance.
 */
function header(rt, cols, frame) {
  const s = rt.state;
  const owl = frame % 2 ? `${T.lime}(${T.bone}o${T.lime},${T.bone}o${T.lime})${T.reset}` : `${T.lime}(${T.bone}-${T.lime},${T.bone}-${T.lime})${T.reset}`;
  const left = `${owl} ${T.bold}${T.lime}PELLET${T.reset} ${T.dim}wake terminal${T.reset}`;
  const chain = s.chain.reachable
    ? `${T.good}chain ${s.chain.chainId}${T.reset}` : `${T.dim}chain unprobed${T.reset}`;
  const mode = s.synthetic ? `${T.warn}${s.mode.toUpperCase()}·SYNTHETIC${T.reset}` : `${T.good}${s.mode.toUpperCase()}${T.reset}`;
  const right = `${mode} ${T.dark}${V}${T.reset} ${chain} ${T.dark}${V}${T.reset} ${T.dim}wake${T.reset} ${s.counters.wake} ${T.dim}cast${T.reset} ${s.counters.cast} ${T.dim}pass${T.reset} ${s.counters.passed}`;
  const gap = Math.max(1, cols - width(left) - width(right));
  return clip(left + ' '.repeat(gap) + right, cols);
}

function eventRow(e, selected, now, w) {
  const c = EVENT_COLOR[e.type] || T.bone;
  const mark = selected ? `${T.lime}▌${T.reset}` : ' ';
  const type = `${c}${pad(e.type, 6)}${T.reset}`;
  const who = pad(e.handle ? `@${e.handle}` : e.symbol ? `$${e.symbol}` : '—', 17);
  const sym = pad(e.handle && e.symbol ? `$${e.symbol}` : '', 10);
  const t = `${T.dark}${pad(ago(e.at, now), 4, 'right')}${T.reset}`;
  const rest = Math.max(8, w - 39);
  return clip(`${mark}${type} ${T.bone}${who}${T.reset}${T.dim}${sym}${T.reset}${pad(e.line || '', rest)}${t}`, w);
}

/** Right pane: everything known about the selected row. */
function detail(rt, e, w) {
  const s = rt.state;
  const out = [];
  if (!e) { out.push(`${T.dim}no row selected${T.reset}`); return out; }

  out.push(rule(w, 'SELECTED'));
  out.push(clip(`${T.bone}${e.type}${T.reset} ${T.dim}${new Date(e.at).toISOString().slice(11, 19)}Z${T.reset}${e.synthetic ? `  ${T.warn}synthetic${T.reset}` : ''}`, w));
  if (e.handle) out.push(clip(`${T.dim}wallet${T.reset}  ${T.lime}@${e.handle}${T.reset}`, w));
  if (e.symbol) out.push(clip(`${T.dim}token${T.reset}   ${T.bone}$${e.symbol}${T.reset}`, w));
  out.push('');

  const c = e.candidate;
  if (!c) {
    out.push(clip(`${T.dim}${e.line || ''}${T.reset}`, w));
    out.push('');
    out.push(rule(w, 'WALLS'));
    for (const [name, want, ask] of ruleSheet(s.rules)) {
      out.push(clip(`${T.dark}${pad(name, 6)}${T.reset}${T.dim}${pad(want, 18)}${ask}${T.reset}`, w));
    }
    return out;
  }

  out.push(rule(w, 'WALLS'));
  for (const wall of c.decision.walls) {
    const colour = wall.state === 'PASS' ? T.good : wall.state === 'FAIL' ? T.bad
      : wall.state === 'UNKNOWN' ? T.warn : T.dark;
    out.push(clip(`${colour}${pad(wall.state === 'PASS' ? '✓' : wall.state === 'FAIL' ? '✗' : wall.state === 'UNKNOWN' ? '?' : '·', 2)}${pad(wall.name, 7)}${T.reset}${T.bone}${pad(wall.shown, 12)}${T.reset}${T.dim}${wall.want}${T.reset}`, w));
  }
  out.push('');
  out.push(clip(`${verdictTag(c.decision.verdict)}  ${T.dim}${c.decision.reason}${T.reset}`, w));
  out.push('');

  out.push(rule(w, 'TICKET'));
  out.push(clip(`${T.dim}size${T.reset}    ${T.bone}${c.ticketEth} ETH${T.reset} ${T.dim}(${usd(c.ticketUsd)})${T.reset}`, w));
  out.push(clip(`${T.dim}median${T.reset}  ${T.bone}${c.wallet.medianTicketEth} ETH${T.reset}`, w));
  out.push(clip(`${T.dim}dna${T.reset}     ${T.bone}${c.wallet.dna}${T.reset}  ${T.dim}wr${T.reset} ${T.bone}${((c.wallet.winRate || 0) * 100).toFixed(0)}%${T.reset}  ${T.dim}trades${T.reset} ${T.bone}${c.wallet.trades}${T.reset}`, w));
  out.push('');

  out.push(rule(w, 'MARKET'));
  out.push(clip(`${T.dim}price${T.reset}   ${T.bone}$${Number(c.token.priceUsd).toPrecision(3)}${T.reset}`, w));
  out.push(clip(`${T.dim}liq${T.reset}     ${T.bone}${usd(c.token.liquidityUsd)}${T.reset}  ${T.dim}mc${T.reset} ${T.bone}${usd(c.token.marketCapUsd)}${T.reset}`, w));
  out.push(clip(`${T.dim}vol24${T.reset}   ${T.bone}${usd(c.token.volume24hUsd)}${T.reset}  ${T.dim}age${T.reset} ${T.bone}${Math.round(c.token.ageHours || 0)}h${T.reset}`, w));
  out.push('');
  out.push(rule(w, 'TOUCHED'));
  out.push(clip(`${T.dim}${(c.wallet.touched || []).slice(0, 8).map((x) => '$' + x).join(' ') || 'nothing yet'}${T.reset}`, w));
  return out;
}

/** Bottom desk: where smart money actually went in the window. */
function deskRows(rt, cols, limit) {
  const rows = rt.desk(limit);
  const out = [rule(cols, `SMART FLOW · ${rt.state.rules.flowWindowMin}m window`)];
  if (rows.length === 0) {
    out.push(clip(`${T.dim}no token has cleared ${rt.state.rules.minFlowWallets} distinct smart wallets yet${T.reset}`, cols));
    return out;
  }
  out.push(clip(`${T.dark}${pad('TOKEN', 12)}${pad('NET FLOW', 12, 'right')}${pad('WALLETS', 10, 'right')}${pad('AVG', 11, 'right')}  TREND${T.reset}`, cols));
  for (const r of rows) {
    const colour = r.netUsd >= 0 ? T.good : T.bad;
    out.push(clip(
      `${T.bone}${pad('$' + r.symbol, 12)}${T.reset}${colour}${pad(usd(r.netUsd), 12, 'right')}${T.reset}` +
      `${T.bone}${pad(String(r.wallets), 10, 'right')}${T.reset}${T.dim}${pad(usd(r.avgUsd), 11, 'right')}${T.reset}  ${colour}${spark(r.spark)}${T.reset}`, cols));
  }
  return out;
}

function footer(rt, cols) {
  const keys = `${T.dim}↑↓${T.reset} move  ${T.dim}f${T.reset} filter  ${T.dim}w${T.reset} wakes  ${T.dim}space${T.reset} roost  ${T.dim}c${T.reset} cough  ${T.dim}p${T.reset} pause  ${T.dim}r${T.reset} refresh  ${T.dim}q${T.reset} quit`;
  const right = `${T.dim}filter${T.reset} ${T.lime}${rt.ui.filter}${T.reset} ${T.dark}${V}${T.reset} ${T.dim}roost${T.reset} ${rt.ui.roost.length}`;
  const gap = Math.max(1, cols - width(keys) - width(right));
  return clip(keys + ' '.repeat(gap) + right, cols);
}

export function frame(rt, cols, rows, frameNo) {
  const now = Date.now();
  const leftW = Math.max(44, Math.floor(cols * 0.58));
  const rightW = cols - leftW - 3;
  const deskH = Math.min(11, Math.max(5, Math.floor(rows * 0.3)));
  const bodyH = Math.max(6, rows - deskH - 4);

  const visible = rt.ui.visibleEvents();
  const start = Math.max(0, Math.min(rt.ui.cursor - Math.floor(bodyH / 2), visible.length - bodyH));
  const slice = visible.slice(Math.max(0, start), Math.max(0, start) + bodyH);
  const selected = visible[rt.ui.cursor] || null;

  const left = [rule(leftW, `STREAM · ${visible.length}`)];
  for (let i = 0; i < bodyH - 1; i += 1) {
    const e = slice[i];
    left.push(e ? eventRow(e, e === selected, now, leftW) : '');
  }

  const right = detail(rt, selected, rightW);

  const out = [header(rt, cols, frameNo), ''];
  for (let i = 0; i < bodyH; i += 1) {
    const l = pad(left[i] ?? '', leftW);
    const r = right[i] ?? '';
    out.push(clip(`${l} ${T.dark}${V}${T.reset} ${r}`, cols));
  }
  out.push(...deskRows(rt, cols, deskH - 2));
  while (out.length < rows - 1) out.push('');
  out.push(footer(rt, cols));
  return out.slice(0, rows).join('\n');
}

export { rule };
