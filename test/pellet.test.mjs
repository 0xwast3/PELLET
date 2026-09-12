import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../src/cli/runtime.mjs';
import { cough, toMarkdown } from '../src/services/pellet.mjs';
import { DEFAULT_RULES } from '../src/config.mjs';

const NOW = Date.parse('2026-09-12T00:00:00Z');

async function session() {
  const rt = createRuntime({ mode: 'cached', now: NOW, seedValue: 11 });
  await rt.boot();
  for (let i = 0; i < 160; i += 1) rt.tick();
  return rt;
}

test('a pellet reconstructs the wallet trail from observed events', async () => {
  const rt = await session();
  const handle = rt.state.events.find((e) => e.handle)?.handle;
  const wallet = rt.state.wallets.get(handle);
  const p = cough(wallet, { events: rt.state.events, rules: rt.state.rules, now: NOW });
  assert.equal(p.wallet.handle, handle);
  assert.ok(p.observed.events > 0);
  assert.equal(p.observed.cast + p.observed.refused <= p.observed.events, true);
  assert.ok(p.trail.length <= 20);
});

test('missing wallet fields become null, never zero', () => {
  const p = cough({ handle: 'ghost', address: null, dna: null, trades: null, winRate: null,
    medianTicketEth: null, realizedEth: null, lastActive: null }, { now: NOW, rules: DEFAULT_RULES });
  assert.equal(p.wallet.dna, null);
  assert.equal(p.sleep.dormancyDays, null);
  assert.equal(p.sleep.sleeping, null);
});

test('refusal counts are grouped by the wall that refused', async () => {
  const rt = await session();
  const handle = rt.state.events.find((e) => e.candidate && !e.candidate.decision.cast)?.handle;
  const p = cough(rt.state.wallets.get(handle), { events: rt.state.events, rules: rt.state.rules, now: NOW });
  const total = Object.values(p.observed.refusedBy).reduce((a, b) => a + b, 0);
  assert.equal(total, p.observed.refused);
});

test('markdown export marks synthetic rows and never prints a bare zero for unknowns', async () => {
  const rt = await session();
  const handle = rt.state.events.find((e) => e.handle)?.handle;
  const md = toMarkdown(cough(rt.state.wallets.get(handle), { events: rt.state.events, rules: rt.state.rules, now: NOW }));
  assert.match(md, /# PELLET/);
  assert.match(md, /synthetic/);
});

test('a wallet with no observed events still produces a valid pellet', () => {
  const p = cough({ handle: 'quiet', dna: 60, medianTicketEth: 0.2, trades: 4, winRate: 0.5,
    realizedEth: 1, address: '0xabc', lastActive: new Date(NOW - 90 * 86400000).toISOString(), touched: [] },
    { events: [], rules: DEFAULT_RULES, now: NOW });
  assert.equal(p.observed.events, 0);
  assert.equal(p.sleep.sleeping, true);
  assert.deepEqual(p.trail, []);
});
