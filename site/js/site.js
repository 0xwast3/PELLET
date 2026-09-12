import { createEngine, loadSeed, evaluate, fmt, DEFAULT_RULES } from './engine.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const rules = DEFAULT_RULES;

/* ---------- copy buttons ---------- */
$$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
  const text = $(b.dataset.copy).textContent;
  try {
    await navigator.clipboard.writeText(text);
    const was = b.textContent;
    b.textContent = 'COPIED';
    setTimeout(() => { b.textContent = was; }, 1400);
  } catch {
    b.textContent = 'SELECT IT';
  }
}));

/* ---------- the owl blinks, exactly as it does in the CLI header ---------- */
const owl = $('#owl');
let lid = false;
setInterval(() => { lid = !lid; owl.textContent = lid ? '(-,-)' : '(o,o)'; }, 2600);

/* ---------- mascot bands ---------- */
const MQ = [
  ['WAKE DETECTION', 'five walls, in order'],
  ['SMART FLOW', 'net USD, distinct wallets'],
  ['THE PELLET', 'nothing is digested'],
  ['ROBINHOOD CHAIN', 'chain 4663'],
  ['NO WALLET CONNECT', 'read-only, always'],
  ['CLI-FIRST', 'the terminal is the product']
];
const mqItem = ([a, b]) =>
  `<span class="marquee-item"><img src="assets/avatar.png" alt=""><em>${a}</em><b>·</b>${b}</span>`;

for (const [id, rows] of [['#mq1', MQ], ['#mq2', [...MQ].reverse()]]) {
  const track = $(id);
  if (track) track.innerHTML = (rows.map(mqItem).join('')).repeat(2);
}

/* a loose flock drifting under the nav — decoration, so it is aria-hidden
   and never rendered when the visitor asked for reduced motion */
const flock = $('#flock');
if (flock && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const N = window.innerWidth < 700 ? 5 : 9;
  const BAND = 132;
  flock.innerHTML = Array.from({ length: N }, (_, i) => {
    const size = 30 + Math.round(Math.random() * 26);
    const top = Math.round(((i * 0.618) % 1) * (BAND - size - 10)) + 5;
    const dur = 19 + Math.random() * 20;
    // spread the head start evenly so the flock never bunches at one edge
    const delay = -(dur * ((i + Math.random() * 0.5) / N));
    return `<img src="assets/avatar.png" alt="" width="${size}" height="${size}"
      style="top:${top}px;width:${size}px;height:${size}px;
      animation-duration:${dur.toFixed(1)}s;animation-delay:${delay.toFixed(1)}s;
      opacity:${(0.4 + Math.random() * 0.35).toFixed(2)}">`;
  }).join('');
}

/* ---------- wall simulator: the real evaluate(), not a mock ---------- */
const sim = {
  kind: 'WAKE',
  read: () => ({
    sleep: +$('#s-sleep').value,
    dna: +$('#s-dna').value,
    ticket: +$('#s-ticket').value / 100,
    median: +$('#s-median').value / 100,
    liq: +$('#s-liq').value * 1000,
    mark: +$('#s-mark').value
  })
};

const ICON = { PASS: '✓', FAIL: '✗', UNKNOWN: '?', 'N/A': '·' };

function runSim() {
  const v = sim.read();
  $('#v-sleep').textContent = v.sleep;
  $('#v-dna').textContent = v.dna;
  $('#v-ticket').textContent = v.ticket.toFixed(2);
  $('#v-median').textContent = v.median.toFixed(2);
  $('#v-liq').textContent = fmt.usd(v.liq);
  $('#v-mark').textContent = v.mark;

  const now = Date.now();
  const d = evaluate({
    kind: sim.kind,
    wallet: { handle: 'sim', dna: v.dna, medianTicketEth: v.median,
      lastActive: new Date(now - v.sleep * 86400000).toISOString() },
    token: { symbol: 'SEDGE', priceUsd: 0.0041, liquidityUsd: v.liq },
    ticketEth: v.ticket,
    ticketUsd: v.ticket * 3100,
    markAgeSec: v.mark
  }, rules, now);

  $('#sim-walls').innerHTML = `<div class="cand">
      <span>candidate <b>${sim.kind.toLowerCase()}</b></span>
      <span>@sim → <b>$SEDGE</b></span>
      <span>ticket <b>${v.ticket.toFixed(2)} ETH</b> (<b>${fmt.usd(v.ticket * 3100)}</b>)</span>
    </div>` + d.walls.map((w) => `
    <div class="wl">
      <span class="s ${w.state === 'N/A' ? 'NA' : w.state}">${ICON[w.state]}</span>
      <span class="n">${w.name}</span>
      <span class="v">${w.shown}</span>
      <span class="dim">${w.want}</span>
    </div>`).join('');

  const box = $('#sim-verdict');
  box.className = `verdict ${d.cast ? 'cast' : 'pass'}`;
  box.innerHTML = `${d.cast ? 'CAST' : 'PASS'}<small>${d.reason}</small>`;
}

$$('#kind button').forEach((b) => b.addEventListener('click', () => {
  sim.kind = b.dataset.kind;
  $$('#kind button').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
  runSim();
}));
$$('.controls input[type=range]').forEach((r) => r.addEventListener('input', runSim));
runSim();

/* ---------- live engine ---------- */
const boot = async () => {
  let seed;
  try {
    seed = await loadSeed();
  } catch {
    $('#hero-mode').textContent = 'SEED UNREACHABLE';
    $('#hero-stream').innerHTML = '<div class="row"><span class="dim">Could not load the bootstrap set. The wall simulator above still works.</span></div>';
    return;
  }

  const eng = createEngine(seed);
  $('#k-pool').textContent = eng.state.wallets.size;

  /* the one loud moment: a silence clock that runs, then breaks */
  const clock = $('#clock');
  let target = null;
  let armedAt = 0;

  function arm() {
    const pool = eng.sleepers(12);
    target = pool[Math.floor(Math.random() * Math.min(6, pool.length))] || null;
    armedAt = Date.now();
    clock.classList.remove('woke');
    if (target) {
      $('#clock-who').textContent = '@' + target.handle;
      $('#clock-cap').textContent = 'SILENT · WALLS ARMED';
    }
  }

  function tickClock() {
    if (!target) return;
    const ms = Date.now() - Date.parse(target.lastActive);
    const days = Math.floor(ms / 86400000);
    const rest = ms % 86400000;
    const hh = String(Math.floor(rest / 3600000)).padStart(2, '0');
    const mm = String(Math.floor(rest % 3600000 / 60000)).padStart(2, '0');
    const ss = String(Math.floor(rest % 60000 / 1000)).padStart(2, '0');
    $('#clock-big').textContent = `${days}d ${hh}:${mm}:${ss}`;
  }

  function wake(e) {
    clock.classList.add('woke');
    $('#clock-who').textContent = '@' + e.handle;
    $('#clock-big').textContent = e.candidate.decision.cast ? 'CAST' : 'PASS';
    $('#clock-cap').textContent = e.candidate.decision.reason.toUpperCase();
    setTimeout(arm, 3400);
  }

  const stream = $('#hero-stream');
  const MAXROWS = 14;

  function paint(events) {
    for (const e of events) {
      if ((e.type === 'MOVE' || e.type === 'CAST') && Math.random() < 0.7) continue;
      const row = document.createElement('div');
      row.className = 'row new';
      row.innerHTML = `<span class="t">${fmt.clock(e.at)}</span>` +
        `<span class="${e.type}">${e.type}</span>` +
        `<span>${e.handle ? '@' + e.handle : ''}</span>` +
        `<span class="dim">${e.symbol ? '$' + e.symbol : ''}</span>` +
        `<span class="dim">${e.line}</span>`;
      stream.prepend(row);
      while (stream.children.length > MAXROWS) stream.lastChild.remove();
      if (e.type === 'WAKE' && e.candidate && Date.now() - armedAt > 4000) wake(e);
    }
    $('#k-wake').textContent = eng.state.counters.wake;
  }

  function paintSleepers() {
    const rows = eng.sleepers(7);
    $('#sleep-count').textContent = `${rows.length} SHOWN`;
    $('#sleepers').innerHTML = rows.map((w) => `<tr>
      <td>@${w.handle}</td>
      <td class="num">${w.days.toFixed(0)}d</td>
      <td class="num">${w.dna}</td></tr>`).join('');
  }

  function paintDesk() {
    const rows = eng.desk(7);
    $('#desk-tag').textContent = rows.length ? `${rows.length} RANKED` : 'BELOW FLOOR';
    $('#desk').innerHTML = rows.length ? rows.map((r) => `<tr>
      <td>$${r.symbol}</td>
      <td class="num ${r.netUsd >= 0 ? 'pos' : 'neg'}">${fmt.usd(r.netUsd)}</td>
      <td class="num">${r.wallets}</td>
      <td class="num dim">${fmt.usd(r.avgUsd)}</td>
      <td class="${r.netUsd >= 0 ? 'pos' : 'neg'}">${fmt.spark(r.spark)}</td></tr>`).join('')
      : `<tr><td colspan="5" class="dim">No token has cleared ${rules.minFlowWallets} distinct wallets yet.</td></tr>`;
  }

  /* ---------- pellet receipt ---------- */
  let picked = null;

  function paintPicker() {
    const pool = eng.sleepers(5);
    if (!picked || !eng.state.wallets.has(picked)) picked = pool[0]?.handle ?? null;
    $('#picker').innerHTML = pool.map((w) =>
      `<button data-h="${w.handle}" aria-pressed="${w.handle === picked}">@${w.handle}</button>`).join('');
    $$('#picker button').forEach((b) => b.addEventListener('click', () => {
      picked = b.dataset.h; paintPicker(); paintReceipt();
    }));
  }

  function paintReceipt() {
    const p = picked ? eng.cough(picked) : null;
    if (!p) { $('#receipt').innerHTML = '<span class="dim">Pick a sleeper.</span>'; return; }
    const w = p.wallet;
    $('#cough-tag').textContent = '@' + w.handle;
    const kv = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
    const by = Object.entries(p.observed.refusedBy);
    $('#receipt').innerHTML =
      kv('address', w.address.slice(0, 10) + '…' + w.address.slice(-6)) +
      kv('dna', w.dna) + kv('trades', w.trades) +
      kv('win rate', (w.winRate * 100).toFixed(0) + '%') +
      kv('median ticket', w.medianTicketEth + ' ETH') +
      kv('realized', w.realizedEth + ' ETH') +
      kv('dormancy', p.dormancyDays.toFixed(1) + 'd') +
      kv('sleeping', p.dormancyDays >= rules.sleepDays ? 'yes' : 'no') +
      '<h4>OBSERVED THIS SESSION</h4>' +
      kv('events', p.observed.events) + kv('wakes', p.observed.wakes) +
      kv('cast', p.observed.cast) + kv('refused', p.observed.refused) +
      (by.length ? '<h4>REFUSED BY WALL</h4><div class="chips">' +
        by.map(([k, v]) => `<span class="chip">${k} × ${v}</span>`).join('') + '</div>' : '') +
      '<h4>TOUCHED</h4><div class="chips">' +
      ((w.touched || []).slice(0, 8).map((s) => `<span class="chip">$${s}</span>`).join('')
        || '<span class="chip">nothing yet</span>') + '</div>' +
      '<p class="notice"><b>Synthetic.</b> Rows on a static host are generated from the bootstrap set.</p>';
  }

  /* warm the session so nothing opens empty */
  for (let i = 0; i < 60; i += 1) eng.tick();
  stream.innerHTML = '';
  paint(eng.state.events.slice(0, MAXROWS).reverse());
  arm(); tickClock(); paintSleepers(); paintDesk(); paintPicker(); paintReceipt();

  setInterval(tickClock, 1000);
  setInterval(() => paint(eng.tick()), 1500);
  setInterval(() => { paintSleepers(); paintDesk(); }, 3000);
  setInterval(() => { paintPicker(); paintReceipt(); }, 6000);
};

boot();
