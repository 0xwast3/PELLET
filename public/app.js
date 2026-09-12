const $ = (id) => document.getElementById(id);
const fmtUsd = (v) => {
  const a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}k`;
  return `${s}$${a.toFixed(0)}`;
};
const clock = (ts) => new Date(ts).toISOString().slice(11, 19);

let selected = null;
let latest = null;

function drawStream(events) {
  const rows = events.map((e) => {
    const pick = e.walls ? ' data-pick="1"' : '';
    return `<tr data-id="${e.id}"${pick} aria-selected="${selected === e.id}" tabindex="${e.walls ? 0 : -1}">
      <td class="dim">${clock(e.at)}</td>
      <td class="t-${e.type}">${e.type}</td>
      <td>${e.handle ? '@' + e.handle : ''}</td>
      <td class="dim">${e.symbol ? '$' + e.symbol : ''}</td>
      <td class="dim">${e.line || ''}</td>
    </tr>`;
  }).join('');
  $('stream').innerHTML = rows || '<tr><td colspan="5" class="dim">Nothing yet.</td></tr>';
}

function drawDetail(e) {
  if (!e) { $('detail').className = 'dim'; $('detail').textContent = 'Pick a row to read its walls.'; return; }
  $('detail').className = '';
  const walls = (e.walls || []).map((w) => `<div class="wall">
      <span class="${w.state === 'N/A' ? 'NA' : w.state}">${w.state === 'PASS' ? '✓' : w.state === 'FAIL' ? '✗' : w.state === 'UNKNOWN' ? '?' : '·'}</span>
      <span>${w.name}</span><span>${w.shown}</span><span class="dim">${w.want}</span>
    </div>`).join('');
  const cast = e.verdict === 'CAST';
  $('detail').innerHTML = `
    <div class="dim">${clock(e.at)} · ${e.type}${e.synthetic ? ' · synthetic' : ''}</div>
    <div>${e.handle ? '@' + e.handle : ''} ${e.symbol ? '<span class="dim">$' + e.symbol + '</span>' : ''}</div>
    <div style="margin-top:12px">${walls}</div>
    <div class="verdict ${cast ? 'cast' : 'pass'}">${cast ? 'CAST' : 'PASS'} — <span class="dim">${e.reason || ''}</span></div>`;
}

function drawDesk(desk) {
  $('desk').innerHTML = desk.length ? desk.map((r) => `<tr>
      <td>$${r.symbol}</td>
      <td class="num ${r.netUsd >= 0 ? 'pos' : 'neg'}">${fmtUsd(r.netUsd)}</td>
      <td class="num">${r.wallets}</td></tr>`).join('')
    : '<tr><td colspan="3" class="dim">No token has cleared the wallet floor yet.</td></tr>';
}

function drawSleepers(list) {
  $('sleepers').innerHTML = list.map((w) => `<tr>
      <td>@${w.handle}</td><td class="num">${w.days.toFixed(0)}d</td><td class="num">${w.dna}</td></tr>`).join('')
    || '<tr><td colspan="3" class="dim">Everyone tracked is awake.</td></tr>';
}

$('stream').addEventListener('click', (ev) => {
  const tr = ev.target.closest('tr[data-pick]');
  if (!tr || !latest) return;
  selected = Number(tr.dataset.id);
  drawStream(latest.events);
  drawDetail(latest.events.find((e) => e.id === selected));
});

async function poll() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    latest = await res.json();
    $('mode').textContent = latest.mode.toUpperCase();
    $('mode').className = latest.synthetic ? 'badge warn' : 'badge';
    $('source').textContent = `markets ${latest.marketSource} · wallets ${latest.walletSource}`;
    drawStream(latest.events);
    drawDesk(latest.desk);
    drawSleepers(latest.sleepers);
    drawDetail(latest.events.find((e) => e.id === selected));
  } catch (err) {
    $('mode').textContent = 'runtime unreachable';
    $('mode').className = 'badge warn';
  }
}

poll();
setInterval(poll, 1500);
