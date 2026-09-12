import { createEngine, loadSeed, fmt, DEFAULT_RULES } from './engine.js';

const out = document.getElementById('out');
const input = document.getElementById('in');
const modeTag = document.getElementById('mode');
const owl = document.getElementById('owl');

let lid = false;
setInterval(() => { lid = !lid; owl.textContent = lid ? '(-,-)' : '(o,o)'; }, 2600);

const rules = DEFAULT_RULES;
const history = [];
let hIndex = -1;
let engine = null;
let live = false;      // a local `pellet web` runtime answered
let streaming = null;  // interval handle for `start`

/* ---------- output helpers ---------- */
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function line(html = '', cls = '') {
  const el = document.createElement('div');
  el.className = `ln ${cls}`;
  el.innerHTML = html;
  out.appendChild(el);
  out.scrollTop = out.scrollHeight;
  return el;
}
const c = (text, cls) => `<span class="${cls}">${esc(text)}</span>`;
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

/* ---------- commands ---------- */
const COMMANDS = {
  help() {
    line();
    line(c('PELLET', 'WAKE') + '  wake terminal · type any command below');
    line();
    const rows = [
      ['start', 'live wake stream in this pane (any key stops it)'],
      ['wake', 'the last decisions, refusals included'],
      ['flow', 'ranked smart-money desk for the window'],
      ['sleepers', 'tracked wallets still silent, longest first'],
      ['wallet <handle>', 'one wallet read out'],
      ['cough <handle>', 'the pellet — full record for one wallet'],
      ['rules', 'the decision box'],
      ['doctor', 'what this page is connected to'],
      ['clear', 'wipe the pane']
    ];
    for (const [k, v] of rows) line('  ' + c(pad(k, 18), 'WAKE') + c(v, 'dim'));
    line();
  },

  clear() { out.innerHTML = ''; },

  doctor() {
    line();
    line(c('pellet doctor', 'WAKE'));
    line();
    line('  ' + c(pad('runtime', 12), 'dim') + (live ? c('local · pellet web', 'pos') : c('in-browser engine', 'FOUND')));
    line('  ' + c(pad('data', 12), 'dim') + (live ? c('live reads', 'pos') : c('bootstrap set · synthetic', 'neg')));
    line('  ' + c(pad('wallets', 12), 'dim') + engine.state.wallets.size + c('  (grows while open)', 'dim'));
    line('  ' + c(pad('tokens', 12), 'dim') + engine.state.universe.size);
    line('  ' + c(pad('keys', 12), 'dim') + c('none · this page cannot sign anything', 'dim'));
    line();
    if (!live) {
      line(c('  Run the repo locally with `pellet web` and reload to read live state.', 'dim'));
      line();
    }
  },

  rules() {
    line();
    line(c('PELLET WALLS', 'WAKE'));
    line();
    const sheet = [
      ['SLEEP', `>= ${rules.sleepDays}d`, 'was it really silent?'],
      ['EDGE', `DNA >= ${rules.minDna}`, 'is the record worth reading?'],
      ['SIZE', `>= ${rules.sizeRatio}x median`, 'a real ticket for this wallet?'],
      ['DEPTH', `<= ${(rules.maxImpact * 100).toFixed(2)}%`, 'is the pool deep enough?'],
      ['PRICE', `<= ${rules.maxMarkAgeSec}s`, 'is the mark fresh?']
    ];
    for (const [n, w, q] of sheet) line('  ' + c(pad(n, 8), 'FOUND') + c(pad(w, 20), 'WAKE') + c(q, 'dim'));
    line();
    line(c(`  evaluated in order · the first failure owns the refusal`, 'dim'));
    line();
  },

  sleepers(arg) {
    const n = Number(arg) || 12;
    line();
    line(c('SLEEPERS', 'WAKE') + c(`  silent >= ${rules.sleepDays}d`, 'dim'));
    line();
    line(c('  ' + pad('WALLET', 20) + rpad('ASLEEP', 8) + rpad('DNA', 6) + rpad('WR', 7) + rpad('MEDIAN', 12), 'dim'));
    for (const w of engine.sleepers(n)) {
      line('  ' + c(pad('@' + w.handle, 20), 'FOUND') +
        c(rpad(w.days.toFixed(0) + 'd', 8), 'WAKE') +
        rpad(w.dna, 6) + rpad(((w.winRate || 0) * 100).toFixed(0) + '%', 7) +
        rpad(w.medianTicketEth + ' ETH', 12));
    }
    line();
  },

  flow(arg) {
    const n = Number(arg) || 10;
    const rows = engine.desk(n);
    line();
    line(c('SMART FLOW', 'WAKE') + c(`  ${rules.flowWindowMin}m window · min ${rules.minFlowWallets} wallets`, 'dim'));
    line();
    if (!rows.length) { line(c('  nothing has cleared the wallet floor yet — let it run', 'dim')); line(); return; }
    line(c('  ' + pad('TOKEN', 12) + rpad('NET FLOW', 12) + rpad('WALLETS', 9) + rpad('AVG', 11) + '  TREND', 'dim'));
    for (const r of rows) {
      line('  ' + c(pad('$' + r.symbol, 12), 'FOUND') +
        c(rpad(fmt.usd(r.netUsd), 12), r.netUsd >= 0 ? 'pos' : 'neg') +
        rpad(r.wallets, 9) + c(rpad(fmt.usd(r.avgUsd), 11), 'dim') +
        '  ' + c(fmt.spark(r.spark), r.netUsd >= 0 ? 'pos' : 'neg'));
    }
    line();
  },

  wake(arg) {
    const castOnly = arg === '--cast-only';
    const rows = engine.state.events.filter((e) => e.candidate && (!castOnly || e.candidate.decision.cast)).slice(0, 14);
    line();
    line(c('WAKE FEED', 'WAKE') + c(castOnly ? '  cast only' : '  refusals included', 'dim'));
    line();
    for (const e of rows.reverse()) printDecision(e);
    line();
  },

  wallet(handle) {
    if (!handle) return fail('usage: wallet <handle>');
    const w = engine.state.wallets.get(handle.replace(/^@/, ''));
    if (!w) return fail(`unknown wallet "${handle}" · try: sleepers`);
    const p = engine.cough(w.handle);
    line();
    line(c('@' + w.handle, 'WAKE') + c('  ' + w.address, 'dim'));
    line(c('  ' + '─'.repeat(58), 'dim'));
    line('  ' + c('dna ', 'dim') + w.dna + c('   trades ', 'dim') + w.trades +
      c('   win rate ', 'dim') + ((w.winRate || 0) * 100).toFixed(0) + '%' +
      c('   median ', 'dim') + w.medianTicketEth + ' ETH');
    line('  ' + c('realized ', 'dim') + w.realizedEth + ' ETH' +
      c('   dormancy ', 'dim') + p.dormancyDays.toFixed(1) + 'd' +
      c('   sleeping ', 'dim') + (p.dormancyDays >= rules.sleepDays ? 'yes' : 'no'));
    line();
    line('  ' + c('observed  ', 'dim') + `${p.observed.events} events · ${p.observed.wakes} wakes · ` +
      c(p.observed.cast + ' cast', 'pos') + ' · ' + c(p.observed.refused + ' refused', 'neg'));
    const by = Object.entries(p.observed.refusedBy);
    if (by.length) line('  ' + c('refused by  ', 'dim') + by.map(([k, v]) => `${k}×${v}`).join('  '));
    line('  ' + c('touched  ', 'dim') + ((w.touched || []).map((s) => '$' + s).join(' ') || '—'));
    line();
  },

  cough(handle) {
    if (!handle) return fail('usage: cough <handle>');
    const p = engine.cough(handle.replace(/^@/, ''));
    if (!p) return fail(`unknown wallet "${handle}"`);
    const w = p.wallet;
    line();
    line(c('# PELLET · ' + w.handle, 'WAKE'));
    line(c('coughed ' + new Date().toISOString(), 'dim'));
    line();
    const kv = (k, v) => line('  ' + c(pad(k, 16), 'dim') + v);
    kv('address', w.address);
    kv('dna', w.dna);
    kv('trades', w.trades);
    kv('win rate', ((w.winRate || 0) * 100).toFixed(1) + '%');
    kv('median ticket', w.medianTicketEth + ' ETH');
    kv('realized', w.realizedEth + ' ETH');
    kv('last active', w.lastActive);
    kv('dormancy', p.dormancyDays.toFixed(1) + 'd');
    kv('sleeping', p.dormancyDays >= rules.sleepDays ? 'yes' : 'no');
    line();
    line(c('  ## trail', 'WAKE'));
    if (!p.trail.length) line(c('  nothing observed yet — run start for a while', 'dim'));
    for (const e of p.trail) printDecision(e, '  ');
    line();
    line(c('  Rows are synthetic on a static host. The CLI writes the same', 'dim'));
    line(c('  record to Markdown or JSON with: pellet cough ' + w.handle, 'dim'));
    line();
  },

  start() {
    if (streaming) return;
    line();
    line(c('streaming · press any key to stop', 'dim'));
    streaming = setInterval(() => {
      for (const e of engine.tick()) {
        if (e.type === 'MOVE' && Math.random() < 0.6) continue;
        if (e.candidate) printDecision(e);
        else line('  ' + c(fmt.clock(e.at) + ' ', 'dim') + c(pad(e.type, 7), e.type) +
          c(pad(e.symbol ? '$' + e.symbol : '@' + (e.handle || ''), 18), 'FOUND') + c(e.line, 'dim'));
      }
    }, 900);
  }
};

function printDecision(e, indent = '  ') {
  const d = e.candidate.decision;
  line(indent + c(fmt.clock(e.at) + ' ', 'dim') + c(pad(e.type, 7), e.type) +
    c(pad('@' + e.handle, 18), 'FOUND') + c(pad('$' + e.symbol, 11), 'dim') +
    c(pad(d.cast ? 'CAST' : 'PASS', 6), d.cast ? 'pos' : 'neg') +
    c(e.line.replace(/ · (CAST|PASS)$/, ''), 'dim'));
  if (!d.cast) line(indent + '        ' + c('└ ' + d.reason, 'dim'));
}

function fail(msg) { line('  ' + c(msg, 'neg')); line(); }

function stopStream() {
  if (!streaming) return false;
  clearInterval(streaming);
  streaming = null;
  line(c('  stopped', 'dim'));
  line();
  return true;
}

/* ---------- input ---------- */
function run(raw) {
  const text = raw.trim();
  line(`<b>$</b> ${esc(text)}`, 'cmd');
  if (!text) return;
  history.unshift(text);
  hIndex = -1;
  const [name, ...rest] = text.split(/\s+/);
  const fn = COMMANDS[name.toLowerCase()];
  if (!fn) return fail(`unknown command "${name}" · type help`);
  try { fn(...rest); } catch (err) { fail(String(err?.message || err)); }
}

input.addEventListener('keydown', (ev) => {
  if (stopStream() && ev.key !== 'Enter') return;
  if (ev.key === 'Enter') { run(input.value); input.value = ''; }
  else if (ev.key === 'ArrowUp') {
    ev.preventDefault();
    if (hIndex < history.length - 1) input.value = history[++hIndex];
  } else if (ev.key === 'ArrowDown') {
    ev.preventDefault();
    input.value = hIndex > 0 ? history[--hIndex] : (hIndex = -1, '');
  }
});
out.addEventListener('click', () => input.focus());

/* ---------- shortcut chips ---------- */
const TRY = ['help', 'start', 'sleepers', 'flow', 'wake --cast-only', 'rules', 'doctor'];
document.getElementById('try').innerHTML = TRY.map((t) => `<button>${t}</button>`).join('');
document.querySelectorAll('#try button').forEach((b) => b.addEventListener('click', () => {
  stopStream(); input.focus(); run(b.textContent);
}));

/* ---------- boot ---------- */
(async () => {
  let seed;
  try { seed = await loadSeed(); }
  catch {
    modeTag.textContent = 'SEED UNREACHABLE';
    line(c('  Could not load the bootstrap set. Reload, or clone the repo and run npm start.', 'neg'));
    return;
  }

  engine = createEngine(seed);

  // if a local `pellet web` runtime is answering, say so
  try {
    const res = await fetch('api/state', { cache: 'no-store' });
    if (res.ok) { await res.json(); live = true; }
  } catch { /* static host — expected */ }

  modeTag.textContent = live ? 'LOCAL RUNTIME' : 'SYNTHETIC';
  modeTag.className = live ? 'tag' : 'tag warn';

  for (let i = 0; i < 45; i += 1) engine.tick();

  line(c('PELLET', 'WAKE') + c('  wake terminal · Robinhood Chain 4663', 'dim'));
  line(c(live ? '  reading the local runtime on this machine'
    : '  in-browser engine · bootstrap set · every row synthetic', 'dim'));
  line();
  COMMANDS.help();
  COMMANDS.sleepers(6);
  line(c('  Try ', 'dim') + c('start', 'WAKE') + c(' to watch it run, or ', 'dim') +
    c('cough <handle>', 'WAKE') + c(' to read one wallet. ', 'dim') + '<span class="caret"></span>');
  line();
  input.focus();
})();
