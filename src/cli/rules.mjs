import { DEFAULT_RULES } from '../config.mjs';

export const WALL_ORDER = ['SLEEP', 'EDGE', 'SIZE', 'DEPTH', 'PRICE'];

export function dormancyDays(wallet, now = Date.now()) {
  const last = Date.parse(wallet.lastActive);
  if (!Number.isFinite(last)) return null;
  return Math.max(0, (now - last) / 86400000);
}

/**
 * Push one candidate through the PELLET walls.
 *
 * A candidate is a { wallet, token, ticketEth, ticketUsd, markAgeSec, kind } triple.
 * kind is 'WAKE' for a sleeper that just moved, 'INFLOW' for an already awake
 * tracked wallet adding size. SLEEP does not apply to INFLOW candidates and is
 * reported as such instead of being silently passed.
 *
 * Returns the verdict, the wall that owns the refusal, and the full wall trace.
 * Unknown inputs never become zero — they refuse with UNKNOWN.
 */
export function evaluate(candidate, rules = DEFAULT_RULES, now = Date.now()) {
  const { wallet, token, ticketEth, ticketUsd, markAgeSec, kind } = candidate;
  const walls = [];
  let failed = null;

  const push = (name, applies, ok, shown, want) => {
    const state = !applies ? 'N/A' : ok === null ? 'UNKNOWN' : ok ? 'PASS' : 'FAIL';
    walls.push({ name, state, shown, want });
    if (!failed && (state === 'FAIL' || state === 'UNKNOWN')) failed = walls[walls.length - 1];
  };

  const days = dormancyDays(wallet, now);
  push('SLEEP', kind === 'WAKE', days === null ? null : days >= rules.sleepDays,
    days === null ? '—' : `${days.toFixed(0)}d`, `>= ${rules.sleepDays}d`);

  push('EDGE', true, Number.isFinite(wallet.dna) ? wallet.dna >= rules.minDna : null,
    Number.isFinite(wallet.dna) ? `${wallet.dna}` : '—', `>= ${rules.minDna}`);

  const need = wallet.medianTicketEth * rules.sizeRatio;
  push('SIZE', true, Number.isFinite(ticketEth) && Number.isFinite(need) ? ticketEth >= need : null,
    Number.isFinite(ticketEth) ? `${ticketEth.toFixed(3)} ETH` : '—',
    Number.isFinite(need) ? `>= ${need.toFixed(3)} ETH` : 'unknown median');

  const impact = token.liquidityUsd > 0 && Number.isFinite(ticketUsd)
    ? ticketUsd / token.liquidityUsd : null;
  push('DEPTH', true, impact === null ? null : impact <= rules.maxImpact,
    impact === null ? '—' : `${(impact * 100).toFixed(2)}%`, `<= ${(rules.maxImpact * 100).toFixed(2)}%`);

  const priceOk = token.priceUsd > 0 && Number.isFinite(markAgeSec)
    ? markAgeSec <= rules.maxMarkAgeSec : null;
  push('PRICE', true, priceOk,
    Number.isFinite(markAgeSec) ? `${Math.round(markAgeSec)}s` : '—', `<= ${rules.maxMarkAgeSec}s`);

  const verdict = failed ? 'PASS_OVER' : 'CAST';
  const reason = failed
    ? `${failed.name} ${failed.state === 'UNKNOWN' ? 'unknown' : failed.shown} · needs ${failed.want}`
    : `all walls clear · ${kind.toLowerCase()} on ${token.symbol}`;

  return { verdict, cast: verdict === 'CAST', failed: failed?.name ?? null, reason, walls };
}

/** Human-readable rule sheet, used by `pellet rules` and the right pane. */
export function ruleSheet(rules = DEFAULT_RULES) {
  return [
    ['SLEEP', `>= ${rules.sleepDays}d`, 'was it really silent?'],
    ['EDGE', `DNA >= ${rules.minDna}`, 'is the record worth reading?'],
    ['SIZE', `>= ${rules.sizeRatio}x median`, 'a real ticket for this wallet?'],
    ['DEPTH', `<= ${(rules.maxImpact * 100).toFixed(2)}%`, 'is the pool deep enough?'],
    ['PRICE', `<= ${rules.maxMarkAgeSec}s`, 'is the mark fresh?']
  ];
}
