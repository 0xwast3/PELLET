import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { createRuntime } from './src/cli/runtime.mjs';
import { ROOT } from './src/config.mjs';
import { read as readState, toggleRoost } from './src/services/state.mjs';
import { cough } from './src/services/pellet.mjs';

const PORT = Number(process.env.PORT || 4721);
const SITE = join(ROOT, 'site');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png'
};

const rt = createRuntime({ mode: process.argv.includes('--live') ? 'live' : 'cached' });
await rt.boot();
setInterval(() => rt.tick(), 1200);

function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname === '/api/state') {
    return json(res, 200, {
      mode: rt.state.mode,
      synthetic: rt.state.synthetic,
      marketSource: rt.state.marketSource,
      walletSource: rt.state.walletSource,
      counters: rt.state.counters,
      rules: rt.state.rules,
      roost: readState().roost,
      desk: rt.desk(10),
      sleepers: rt.sleepers(10).map((w) => ({ handle: w.handle, days: w.days, dna: w.dna, medianTicketEth: w.medianTicketEth })),
      events: rt.state.events.slice(0, 60).map((e) => ({
        id: e.id, at: e.at, type: e.type, symbol: e.symbol ?? null, handle: e.handle ?? null,
        line: e.line, synthetic: e.synthetic,
        verdict: e.candidate?.decision?.verdict ?? null,
        reason: e.candidate?.decision?.reason ?? null,
        walls: e.candidate?.decision?.walls ?? null
      }))
    });
  }

  if (url.pathname === '/api/roost' && req.method === 'POST') {
    const handle = url.searchParams.get('handle');
    if (!handle) return json(res, 400, { error: 'handle required' });
    return json(res, 200, toggleRoost(handle, rt.state.rules.roostLimit));
  }

  if (url.pathname === '/api/pellet') {
    const handle = url.searchParams.get('handle');
    const wallet = handle ? rt.state.wallets.get(handle) : null;
    if (!wallet) return json(res, 404, { error: 'unknown wallet' });
    return json(res, 200, cough(wallet, { events: rt.state.events, rules: rt.state.rules }));
  }

  // static site, served from the same folder Netlify publishes
  let file = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  if (!extname(file)) file += '.html';
  if (file.includes('..')) { res.writeHead(400).end('bad path'); return; }
  try {
    const body = await readFile(join(SITE, file));
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(
    `PELLET site on http://127.0.0.1:${PORT}\n` +
    `Serving ./site against the live runtime. Read-only: no wallet connect, no signing.\n`
  );
});

export { server };
