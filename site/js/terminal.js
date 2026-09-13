import { createEngine, loadSeed, fmt, DEFAULT_RULES } from './engine.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const rules = DEFAULT_RULES;

const feed = $('#feed');
const output = $('#output');
const inspect = $('#inspect');
const walletPane = $('#wallet');
const input = $('#in');
const runBtn = $('#run');

let engine = null;
let live = false;
let timer = null;
let filter = 'ALL';
let selected = null;
const history = [];
let hIndex = -1;
const MAXROWS = 160;

/* the owl blinks in the header exactly as it does in the CLI */
const owl = $('#owl');
let lid = false;
setInterval(() => { lid = !lid; owl.textContent = lid ? '(-,-)' : '(o,o)'; }, 2600);

/* ---------- output pane helpers ---------- */
const esc = (s) => String(s).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
const c = (text, cls) => `<span class="${cls}">${esc(text)}</span>`;
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

function line(html = '', cls = '') {
  const el = document.createElement('div');
  el.className = `ln ${cls}`;
  el.innerHTML = html;
  output.appendChild(el);
  output.scrollTop = output.scrollHeight;
}

function showTab(name) {
  $$('.pane-head [data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === name)));
  inspect.hidden = name !== 'inspect';
  walletPane.hidden = name !== 'wallet';
  output.hidden = name !== 'output';
}

/* ---------- roost: a local watchlist, mirrored to the CLI's `pellet roost` ---------- */
const ROOST_KEY = 'pellet.roost';
const roost = new Set();
try { for (const h of JSON.parse(localStorage.getItem(ROOST_KEY) || '[]')) roost.add(h); } catch { /* private mode */ }
function toggleRoost(handle) {
  roost.has(handle) ? roost.delete(handle) : roost.add(handle);
  try { localStorage.setItem(ROOST_KEY, JSON.stringify([...roost])); } catch { /* not fatal */ }
}

/* ---------- wallet dossier: what the visitor sees when they check a sleeper ---------- */
let openWallet = null;

function drawWallet(handle) {
  openWallet = handle;
  const p = handle ? engine.cough(handle) : null;
  if (!p) {
    walletPane.innerHTML = `<p class="notice" style="margin:0">Click a
      <span class="WAKE">handle</span> in the stream to open that wallet.</p>`;
    return;
  }
  const w = p.wallet;
  const sleeping = p.dormancyDays >= rules.sleepDays;
  const kv = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
  const by = Object.entries(p.observed.refusedBy);
  const decided = p.observed.cast + p.observed.refused;
  const hit = decided ? Math.round((p.observed.cast / decided) * 100) : 0;

  walletPane.innerHTML = `
    <div class="top">
      <b>@${w.handle}</b>
      <span class="state ${sleeping ? 'sleeping' : 'awake'}">${sleeping ? 'STILL ASLEEP' : 'AWAKE'}</span>
    </div>
    <div class="addr">${w.address}</div>

    <div class="acts">
      <button data-act="cough">COUGH PELLET</button>
      <button data-act="copy">COPY ADDRESS</button>
      <button data-act="roost" aria-pressed="${roost.has(w.handle)}">${roost.has(w.handle) ? 'ROOSTED' : 'ROOST'}</button>
    </div>

    <h4>RECORD</h4>
    <div class="receipt">
      ${kv('dna', w.dna)}
      ${kv('trades', w.trades)}
      ${kv('win rate', ((w.winRate || 0) * 100).toFixed(0) + '%')}
      ${kv('median ticket', w.medianTicketEth + ' ETH')}
      ${kv('realized', w.realizedEth + ' ETH')}
      ${kv('dormancy', p.dormancyDays.toFixed(1) + 'd')}
      ${kv('threshold', rules.sleepDays + 'd')}
    </div>

    <h4>THIS SESSION</h4>
    <div class="receipt">
      ${kv('events seen', p.observed.events)}
      ${kv('wakes', p.observed.wakes)}
      ${kv('cast', p.observed.cast)}
      ${kv('refused', p.observed.refused)}
    </div>
    ${decided ? `<div style="margin-top:10px">
      <div class="kv"><span>cleared the walls</span><b>${hit}% of ${decided}</b></div>
      <div class="bar"><i style="width:${hit}%"></i></div>
    </div>` : ''}

    ${by.length ? `<h4>REFUSED BY WALL</h4><div class="chips">
      ${by.map(([k, v]) => `<span class="chip">${k} × ${v}</span>`).join('')}</div>` : ''}

    <h4>TOUCHED</h4>
    <div class="chips">${(w.touched || []).slice(0, 10).map((t) => `<span class="chip">$${t}</span>`).join('')
      || '<span class="chip">nothing yet</span>'}</div>

    <h4>TRAIL</h4>
    <div class="trail">${p.trail.length ? p.trail.map((e) => {
      const d = e.candidate?.decision;
      return `<div class="tr">
        <span class="dim">${fmt.clock(e.at)}</span>
        <span class="${e.type}">${e.type}</span>
        <span class="dim">${e.symbol ? '$' + e.symbol : '—'}</span>
        <span class="${d ? (d.cast ? 'pos' : 'neg') : 'dim'}">${d ? (d.cast ? 'CAST' : 'PASS') : '—'}</span>
      </div>`;
    }).join('') : '<div class="empty">Nothing observed yet. Let the stream run.</div>'}</div>

    <p class="notice" style="margin-top:16px">
      <b>Synthetic.</b> On a static host this record is built from the bootstrap
      set. The CLI writes the same shape to a file with
      <code>pellet cough ${w.handle}</code>.
    </p>`;

  walletPane.querySelector('[data-act="cough"]').addEventListener('click', () => {
    run(`cough ${w.handle}`);
  });
  walletPane.querySelector('[data-act="copy"]').addEventListener('click', async (ev) => {
    try { await navigator.clipboard.writeText(w.address); ev.target.textContent = 'COPIED'; }
    catch { ev.target.textContent = 'SELECT IT'; }
    setTimeout(() => { ev.target.textContent = 'COPY ADDRESS'; }, 1500);
  });
  walletPane.querySelector('[data-act="roost"]').addEventListener('click', (ev) => {
    toggleRoost(w.handle);
    ev.target.setAttribute('aria-pressed', String(roost.has(w.handle)));
    ev.target.textContent = roost.has(w.handle) ? 'ROOSTED' : 'ROOST';
  });
}

function openWalletTab(handle) { drawWallet(handle); showTab('wallet'); }

/* ---------- commands ---------- */
const RAIL = [
  ['READ', ['help', 'rules', 'doctor']],
  ['DATA', ['sleepers', 'flow', 'wake', 'check']],
  ['EXPORT', ['cough', 'clear']]
];

const COMMANDS = {
  help() {
    line();
    line(c('PELLET', 'WAKE') + '  ' + c('wake terminal · type a command or use the rail', 'dim'));
    line();
    for (const [k, v] of [
      ['rules', 'the five walls and their current thresholds'],
      ['sleepers [n]', 'tracked wallets still silent, longest first'],
      ['flow [n]', 'ranked smart-money desk for the window'],
      ['wake [--cast-only]', 'the last decisions, refusals included'],
      ['wallet <handle>', 'one wallet read out'],
      ['cough [handle]', 'the pellet — full record for one wallet'],
      ['check <handle>', 'open a wallet in the WALLET pane'],
      ['doctor', 'what this page is connected to'],
      ['clear', 'wipe this pane']
    ]) line('  ' + c(pad(k, 20), 'WAKE') + c(v, 'dim'));
    line();
    line(c('  START runs the stream. Click a decided row to inspect its walls.', 'dim'));
    line();
  },

  clear() { output.innerHTML = ''; },

  doctor() {
    line();
    line(c('pellet doctor', 'WAKE'));
    line();
    const kv = (k, v) => line('  ' + c(pad(k, 12), 'dim') + v);
    kv('runtime', live ? c('local · pellet web', 'pos') : c('in-browser engine', 'FOUND'));
    kv('data', live ? c('live reads', 'pos') : c('bootstrap set · synthetic', 'neg'));
    kv('wallets', engine.state.wallets.size + c('  (grows while running)', 'dim'));
    kv('tokens', engine.state.universe.size);
    kv('stream', timer ? c('running', 'pos') : c('stopped', 'dim'));
    kv('keys', c('none · this page cannot sign anything', 'dim'));
    line();
    if (!live) { line(c('  Run the repo with `pellet web` and reload to read live state.', 'dim')); line(); }
  },

  rules() {
    line();
    line(c('PELLET WALLS', 'WAKE'));
    line();
    for (const [n, w, q] of [
      ['SLEEP', `>= ${rules.sleepDays}d`, 'was it really silent?'],
      ['EDGE', `DNA >= ${rules.minDna}`, 'is the record worth reading?'],
      ['SIZE', `>= ${rules.sizeRatio}x median`, 'a real ticket for this wallet?'],
      ['DEPTH', `<= ${(rules.maxImpact * 100).toFixed(2)}%`, 'is the pool deep enough?'],
      ['PRICE', `<= ${rules.maxMarkAgeSec}s`, 'is the mark fresh?']
    ]) line('  ' + c(pad(n, 8), 'FOUND') + c(pad(w, 20), 'WAKE') + c(q, 'dim'));
    line();
    line(c('  evaluated in order · the first failure owns the refusal', 'dim'));
    line(c('  unknown inputs refuse with UNKNOWN, they never become zero', 'dim'));
    line();
  },

  sleepers(arg) {
    line();
    line(c('SLEEPERS', 'WAKE') + c(`  silent >= ${rules.sleepDays}d`, 'dim'));
    line();
    line(c('  ' + pad('WALLET', 20) + rpad('ASLEEP', 8) + rpad('DNA', 6) + rpad('WR', 7) + rpad('MEDIAN', 12), 'dim'));
    for (const w of engine.sleepers(Number(arg) || 12)) {
      line('  ' + c(pad('@' + w.handle, 20), 'FOUND') + c(rpad(w.days.toFixed(0) + 'd', 8), 'WAKE') +
        rpad(w.dna, 6) + rpad(((w.winRate || 0) * 100).toFixed(0) + '%', 7) + rpad(w.medianTicketEth + ' ETH', 12));
    }
    line();
  },

  flow(arg) {
    const rows = engine.desk(Number(arg) || 10);
    line();
    line(c('SMART FLOW', 'WAKE') + c(`  ${rules.flowWindowMin}m window · min ${rules.minFlowWallets} wallets`, 'dim'));
    line();
    if (!rows.length) { line(c('  nothing has cleared the wallet floor yet — press START', 'dim')); line(); return; }
    line(c('  ' + pad('TOKEN', 12) + rpad('NET FLOW', 12) + rpad('WALLETS', 9) + rpad('AVG', 11) + '  TREND', 'dim'));
    for (const r of rows) {
      line('  ' + c(pad('$' + r.symbol, 12), 'FOUND') + c(rpad(fmt.usd(r.netUsd), 12), r.netUsd >= 0 ? 'pos' : 'neg') +
        rpad(r.wallets, 9) + c(rpad(fmt.usd(r.avgUsd), 11), 'dim') + '  ' +
        c(fmt.spark(r.spark), r.netUsd >= 0 ? 'pos' : 'neg'));
    }
    line();
  },

  wake(arg) {
    const castOnly = arg === '--cast-only';
    const rows = engine.state.events
      .filter((e) => e.candidate && (!castOnly || e.candidate.decision.cast)).slice(0, 16);
    line();
    line(c('WAKE FEED', 'WAKE') + c(castOnly ? '  cast only' : '  refusals included', 'dim'));
    line();
    if (!rows.length) { line(c('  no decisions yet — press START', 'dim')); line(); return; }
    for (const e of rows.reverse()) {
      const d = e.candidate.decision;
      line('  ' + c(fmt.clock(e.at) + ' ', 'dim') + c(pad(e.type, 7), e.type) +
        c(pad('@' + e.handle, 18), 'FOUND') + c(pad('$' + e.symbol, 11), 'dim') +
        c(pad(d.cast ? 'CAST' : 'PASS', 6), d.cast ? 'pos' : 'neg'));
      if (!d.cast) line('          ' + c('└ ' + d.reason, 'dim'));
    }
    line();
  },

  check(handle) {
    const target = handle ? handle.replace(/^@/, '') : engine.sleepers(1)[0]?.handle;
    if (!target || !engine.state.wallets.get(target)) return fail(`unknown wallet "${handle || ''}" · try sleepers`);
    openWalletTab(target);
  },

  wallet(handle) {
    if (!handle) return fail('usage: wallet <handle> · try sleepers first');
    const w = engine.state.wallets.get(handle.replace(/^@/, ''));
    if (!w) return fail(`unknown wallet "${handle}"`);
    const p = engine.cough(w.handle);
    line();
    line(c('@' + w.handle, 'WAKE') + c('  ' + w.address, 'dim'));
    line('  ' + c('dna ', 'dim') + w.dna + c('   trades ', 'dim') + w.trades +
      c('   wr ', 'dim') + ((w.winRate || 0) * 100).toFixed(0) + '%' +
      c('   median ', 'dim') + w.medianTicketEth + ' ETH');
    line('  ' + c('realized ', 'dim') + w.realizedEth + ' ETH' +
      c('   dormancy ', 'dim') + p.dormancyDays.toFixed(1) + 'd');
    line();
    line('  ' + c('observed  ', 'dim') + `${p.observed.events} events · ` +
      c(p.observed.cast + ' cast', 'pos') + ' · ' + c(p.observed.refused + ' refused', 'neg'));
    const by = Object.entries(p.observed.refusedBy);
    if (by.length) line('  ' + c('refused by  ', 'dim') + by.map(([k, v]) => `${k}×${v}`).join('  '));
    line();
  },

  cough(handle) {
    const target = handle ? handle.replace(/^@/, '') : engine.sleepers(1)[0]?.handle;
    const p = target ? engine.cough(target) : null;
    if (!p) return fail('usage: cough <handle>');
    const w = p.wallet;
    line();
    line(c('# PELLET · ' + w.handle, 'WAKE'));
    line(c('coughed ' + new Date().toISOString(), 'dim'));
    line();
    const kv = (k, v) => line('  ' + c(pad(k, 16), 'dim') + v);
    kv('address', w.address);
    kv('dna', w.dna); kv('trades', w.trades);
    kv('win rate', ((w.winRate || 0) * 100).toFixed(1) + '%');
    kv('median ticket', w.medianTicketEth + ' ETH');
    kv('realized', w.realizedEth + ' ETH');
    kv('last active', w.lastActive);
    kv('dormancy', p.dormancyDays.toFixed(1) + 'd');
    kv('sleeping', p.dormancyDays >= rules.sleepDays ? 'yes' : 'no');
    line();
    line(c('  ## trail', 'WAKE'));
    if (!p.trail.length) line(c('  nothing observed yet — press START and let it run', 'dim'));
    for (const e of p.trail) {
      const d = e.candidate?.decision;
      line('  ' + c(fmt.clock(e.at) + ' ', 'dim') + c(pad(e.type, 7), e.type) +
        c(pad('$' + (e.symbol || '—'), 11), 'dim') +
        (d ? c(d.cast ? 'CAST' : 'PASS', d.cast ? 'pos' : 'neg') : ''));
    }
    line();
    line(c('  The CLI writes this to Markdown or JSON:', 'dim'));
    line(c('  pellet cough ' + w.handle + ' --format md', 'WAKE'));
    line();
  }
};

function fail(msg) { line('  ' + c(msg, 'neg')); line(); }

/* ---------- stream ---------- */
const matches = (e) => {
  if (filter === 'ALL') return true;
  if (filter === 'WAKE') return e.type === 'WAKE';
  if (!e.candidate) return false;
  return filter === 'CAST' ? e.candidate.decision.cast : !e.candidate.decision.cast;
};

function rowNode(e) {
  const row = document.createElement('div');
  row.className = 'row new' + (e.candidate ? ' pickable' : '');
  row.dataset.id = e.id;
  row.setAttribute('aria-selected', String(selected === e.id));
  const verdict = e.candidate ? (e.candidate.decision.cast ? 'CAST' : 'PASS') : '';
  row.innerHTML =
    `<span class="t">${fmt.clock(e.at)}</span>` +
    `<span class="${e.type}">${e.type}</span>` +
    `<span>${e.handle ? `<span class="who-link" data-who="${e.handle}">@${e.handle}</span>` : ''}</span>` +
    `<span class="dim">${e.symbol ? '$' + e.symbol : ''}</span>` +
    `<span class="${verdict === 'CAST' ? 'pos' : verdict === 'PASS' ? 'neg' : 'dim'}">${
      esc(e.line.replace(/ · (CAST|PASS)$/, ''))}</span>`;
  const who = row.querySelector('[data-who]');
  if (who) who.addEventListener('click', (ev) => { ev.stopPropagation(); openWalletTab(who.dataset.who); });
  if (e.candidate) row.addEventListener('click', () => { selected = e.id; paintSelection(); drawInspector(e); showTab('inspect'); });
  return row;
}

function paintSelection() {
  $$('#feed .row').forEach((r) => r.setAttribute('aria-selected', String(Number(r.dataset.id) === selected)));
}

const ICON = { PASS: '✓', FAIL: '✗', UNKNOWN: '?', 'N/A': '·' };

function drawInspector(e) {
  if (!e) {
    inspect.innerHTML = `<p class="notice" style="margin:0">Press <strong>START</strong>, then click any
      <span class="WAKE">WAKE</span> or <span class="INFLOW">INFLOW</span> row to read the five walls
      that decided it.</p>`;
    return;
  }
  const d = e.candidate.decision;
  const cd = e.candidate;
  inspect.innerHTML = `
    <div class="cand" style="margin:-14px -14px 14px">
      <span>${e.type.toLowerCase()} <b>@${e.handle}</b></span>
      <span>on <b>$${e.symbol}</b></span>
      <span>${fmt.clock(e.at)}${e.synthetic ? ' · synthetic' : ''}</span>
    </div>
    ${d.walls.map((w) => `<div class="wl">
      <span class="s ${w.state === 'N/A' ? 'NA' : w.state}">${ICON[w.state]}</span>
      <span class="n">${w.name}</span><span class="v">${w.shown}</span><span class="dim">${w.want}</span>
    </div>`).join('')}
    <div class="verdict ${d.cast ? 'cast' : 'pass'}">${d.cast ? 'CAST' : 'PASS'}<small>${esc(d.reason)}</small></div>
    <div class="acts" style="margin:14px 0 0"><button data-act="open-wallet">CHECK @${e.handle} →</button></div>
    <h4 style="margin:18px 0 8px;font:400 11px/1 var(--mono);color:var(--lime);letter-spacing:.16em">TICKET</h4>
    <div class="receipt">
      <div class="kv"><span>size</span><b>${cd.ticketEth} ETH</b></div>
      <div class="kv"><span>in usd</span><b>${fmt.usd(cd.ticketUsd)}</b></div>
      <div class="kv"><span>wallet median</span><b>${cd.wallet.medianTicketEth} ETH</b></div>
      <div class="kv"><span>dna</span><b>${cd.wallet.dna}</b></div>
      <div class="kv"><span>liquidity</span><b>${fmt.usd(cd.token.liquidityUsd)}</b></div>
    </div>`;
  inspect.querySelector('[data-act="open-wallet"]')
    ?.addEventListener('click', () => openWalletTab(e.handle));
}

function pushEvents(events) {
  for (const e of events) {
    // keep the inspector on the newest decision until the visitor picks one
    if (e.candidate && selected === null) drawInspector(e);
    if (openWallet && e.handle === openWallet) drawWallet(openWallet);
    if ((e.type === 'MOVE' || e.type === 'CAST') && Math.random() < 0.82) continue;
    if (!matches(e)) continue;
    feed.prepend(rowNode(e));
    while (feed.children.length > MAXROWS) feed.lastChild.remove();
  }
  const k = engine.state.counters;
  $('#k-wake').textContent = k.wake;
  $('#k-cast').textContent = k.cast;
  $('#k-pass').textContent = k.passed;
}

function repaintFeed() {
  feed.innerHTML = '';
  const quiet = engine.state.events
    .filter((e) => matches(e) && !((e.type === 'MOVE' || e.type === 'CAST') && Math.random() < 0.82));
  for (const e of quiet.slice(0, MAXROWS).reverse()) feed.prepend(rowNode(e));
}

function drawDesk() {
  const rows = engine.desk(6);
  $('#desk-tag').textContent = rows.length ? `${rows.length} RANKED` : 'BELOW FLOOR';
  $('#desk').innerHTML = rows.length ? rows.map((r) => `<tr>
      <td>$${r.symbol}</td>
      <td class="num ${r.netUsd >= 0 ? 'pos' : 'neg'}">${fmt.usd(r.netUsd)}</td>
      <td class="num">${r.wallets}</td>
      <td class="num dim">${fmt.usd(r.avgUsd)}</td>
      <td class="${r.netUsd >= 0 ? 'pos' : 'neg'}">${fmt.spark(r.spark)}</td></tr>`).join('')
    : `<tr><td colspan="5" class="dim">No token has cleared ${rules.minFlowWallets} distinct wallets yet.</td></tr>`;
}

function setRunning(on) {
  if (on && !timer) {
    timer = setInterval(() => { pushEvents(engine.tick()); drawDesk(); }, 850);
  } else if (!on && timer) {
    clearInterval(timer); timer = null;
  }
  runBtn.dataset.on = String(Boolean(timer));
  runBtn.textContent = timer ? '❚❚ PAUSE' : '▶ START';
}

/* ---------- input ---------- */
function run(raw) {
  const text = raw.trim();
  if (!text) return;
  showTab('output');
  line(`<b>$</b> ${esc(text)}`, 'cmd');
  history.unshift(text); hIndex = -1;
  const [name, ...rest] = text.split(/\s+/);
  const fn = COMMANDS[name.toLowerCase()];
  if (!fn) return fail(`unknown command "${name}" · type help`);
  try { fn(...rest); } catch (err) { fail(String(err?.message || err)); }
}

input.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') { run(input.value); input.value = ''; }
  else if (ev.key === 'ArrowUp') { ev.preventDefault(); if (hIndex < history.length - 1) input.value = history[++hIndex]; }
  else if (ev.key === 'ArrowDown') { ev.preventDefault(); input.value = hIndex > 0 ? history[--hIndex] : (hIndex = -1, ''); }
});

runBtn.addEventListener('click', () => setRunning(!timer));
$('#wipe').addEventListener('click', () => { output.innerHTML = ''; showTab('output'); });
$$('.pane-head [data-tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
$$('.pane-head [data-filter]').forEach((b) => b.addEventListener('click', () => {
  filter = b.dataset.filter;
  $$('.pane-head [data-filter]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
  repaintFeed();
}));

/* keyboard: space toggles the stream unless you are typing */
document.addEventListener('keydown', (ev) => {
  if (ev.target === input) return;
  if (ev.code === 'Space') { ev.preventDefault(); setRunning(!timer); }
});

/* ---------- rail ---------- */
$('#rail').innerHTML = RAIL.map(([group, items]) => `<h4>${group}</h4>` +
  items.map((cmd) => `<button data-cmd="${cmd}"><i>&gt;</i> ${cmd}</button>`).join('')).join('');
$$('#rail button').forEach((b) => b.addEventListener('click', () => {
  $$('#rail button').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
  run(b.dataset.cmd);
}));

/* ---------- boot ---------- */
(async () => {
  let seed;
  try { seed = await loadSeed(); }
  catch {
    $('#mode').textContent = 'SEED UNREACHABLE';
    line(c('  Could not load the bootstrap set. Reload, or clone the repo and run npm start.', 'neg'));
    return;
  }

  engine = createEngine(seed);

  try {
    const res = await fetch('api/state', { cache: 'no-store' });
    if (res.ok) { await res.json(); live = true; }
  } catch { /* static host — expected */ }

  $('#mode').textContent = live ? 'LOCAL RUNTIME' : 'SYNTHETIC';
  $('#mode').className = live ? 'tag' : 'tag warn';

  for (let i = 0; i < 55; i += 1) engine.tick();
  repaintFeed(); drawDesk();
  drawInspector(engine.state.events.find((e) => e.candidate) || null);
  drawWallet(null);

  COMMANDS.help();
  line(c('  ', 'dim') + '<span class="caret"></span>');

  setRunning(true);
})();
