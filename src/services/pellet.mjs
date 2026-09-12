import { dormancyDays } from '../cli/rules.mjs';

/**
 * A pellet is the readable record of one wallet: what it swallowed, when it
 * went quiet, what it woke on, and what the walls said each time.
 *
 * Fields the runtime could not observe are null, never zero.
 */
export function cough(wallet, { events = [], now = Date.now(), rules } = {}) {
  const mine = events.filter((e) => e.handle === wallet.handle);
  const wakes = mine.filter((e) => e.type === 'WAKE');
  const casts = mine.filter((e) => e.candidate?.decision?.cast);
  const refusals = mine.filter((e) => e.candidate && !e.candidate.decision.cast);

  const byWall = {};
  for (const e of refusals) {
    const w = e.candidate.decision.failed;
    if (w) byWall[w] = (byWall[w] || 0) + 1;
  }

  return {
    schema: 1,
    coughedAt: new Date(now).toISOString(),
    wallet: {
      handle: wallet.handle,
      address: wallet.address ?? null,
      dna: Number.isFinite(wallet.dna) ? wallet.dna : null,
      trades: Number.isFinite(wallet.trades) ? wallet.trades : null,
      winRate: Number.isFinite(wallet.winRate) ? wallet.winRate : null,
      medianTicketEth: Number.isFinite(wallet.medianTicketEth) ? wallet.medianTicketEth : null,
      realizedEth: Number.isFinite(wallet.realizedEth) ? wallet.realizedEth : null,
      tags: wallet.tags ?? []
    },
    sleep: {
      lastActive: wallet.lastActive ?? null,
      dormancyDays: wallet.lastActive ? Number(dormancyDays(wallet, now).toFixed(1)) : null,
      threshold: rules?.sleepDays ?? null,
      sleeping: wallet.lastActive ? dormancyDays(wallet, now) >= (rules?.sleepDays ?? Infinity) : null
    },
    observed: {
      events: mine.length,
      wakes: wakes.length,
      cast: casts.length,
      refused: refusals.length,
      refusedBy: byWall,
      touched: wallet.touched ?? []
    },
    trail: mine.slice(0, 20).map((e) => ({
      at: new Date(e.at).toISOString(),
      type: e.type,
      symbol: e.symbol ?? null,
      ticketEth: e.candidate?.ticketEth ?? null,
      verdict: e.candidate?.decision?.verdict ?? null,
      reason: e.candidate?.decision?.reason ?? null,
      synthetic: Boolean(e.synthetic)
    }))
  };
}

export function toMarkdown(p) {
  const w = p.wallet;
  const pct = (v) => (v === null ? 'unknown' : `${(v * 100).toFixed(1)}%`);
  const num = (v, s = '') => (v === null ? 'unknown' : `${v}${s}`);
  const lines = [
    `# PELLET · ${w.handle}`,
    '',
    `Coughed ${p.coughedAt}`,
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Address | \`${w.address ?? 'unknown'}\` |`,
    `| DNA | ${num(w.dna)} |`,
    `| Trades | ${num(w.trades)} |`,
    `| Win rate | ${pct(w.winRate)} |`,
    `| Median ticket | ${num(w.medianTicketEth, ' ETH')} |`,
    `| Realized | ${num(w.realizedEth, ' ETH')} |`,
    `| Last active | ${p.sleep.lastActive ?? 'unknown'} |`,
    `| Dormancy | ${num(p.sleep.dormancyDays, 'd')} |`,
    `| Sleeping | ${p.sleep.sleeping === null ? 'unknown' : p.sleep.sleeping ? 'yes' : 'no'} |`,
    '',
    `## Observed this session`,
    '',
    `${p.observed.events} events · ${p.observed.wakes} wakes · ${p.observed.cast} cast · ${p.observed.refused} refused`,
    ''
  ];
  const walls = Object.entries(p.observed.refusedBy);
  if (walls.length) {
    lines.push('Refused by wall:', '');
    for (const [k, v] of walls) lines.push(`- \`${k}\` × ${v}`);
    lines.push('');
  }
  if (p.trail.length) {
    lines.push('## Trail', '', '| Time | Type | Token | Ticket | Verdict | Reason |', '| --- | --- | --- | --- | --- | --- |');
    for (const t of p.trail) {
      lines.push(`| ${t.at} | ${t.type} | ${t.symbol ?? '—'} | ${t.ticketEth ?? '—'} | ${t.verdict ?? '—'} | ${t.reason ?? '—'} |`);
    }
    lines.push('');
  }
  if (p.trail.some((t) => t.synthetic)) {
    lines.push('> Rows marked synthetic came from a NIGHT or bootstrap stream, not a live chain read.', '');
  }
  return lines.join('\n');
}
