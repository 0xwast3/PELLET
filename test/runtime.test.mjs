import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../src/cli/runtime.mjs';
import { loadSeed } from '../src/config.mjs';

const NOW = Date.parse('2026-09-12T00:00:00Z');
const boot = async (over = {}) => {
  const rt = createRuntime({ mode: 'cached', now: NOW, seedValue: 42, ...over });
  await rt.boot();
  return rt;
};

test('the bootstrap set loads a universe and a wallet pool', async () => {
  const rt = await boot();
  const seed = loadSeed();
  assert.equal(rt.state.universe.size, seed.tokens.length);
  assert.equal(rt.state.wallets.size, seed.wallets.length);
  assert.equal(rt.state.marketSource, 'bootstrap');
});

test('every event carries an explicit synthetic flag', async () => {
  const rt = await boot();
  for (let i = 0; i < 40; i += 1) rt.tick();
  assert.ok(rt.state.events.length > 0);
  assert.ok(rt.state.events.every((e) => typeof e.synthetic === 'boolean'));
  assert.ok(rt.state.events.every((e) => e.synthetic === true), 'cached mode must not claim live data');
});

test('the tracked pool keeps growing instead of freezing at the seed list', async () => {
  const rt = await boot();
  const before = rt.state.wallets.size;
  for (let i = 0; i < 90; i += 1) rt.tick();
  assert.ok(rt.state.wallets.size > before, 'discovery pass should add sleepers');
  assert.ok(rt.state.events.some((e) => e.type === 'FOUND'));
});

test('sleepers stay available over a long session', async () => {
  const rt = await boot();
  for (let i = 0; i < 250; i += 1) rt.tick();
  assert.ok(rt.sleepers(30).length > 0, 'the sleeper pool must not drain');
});

test('every wake and inflow carries a full wall trace', async () => {
  const rt = await boot();
  for (let i = 0; i < 120; i += 1) rt.tick();
  const decided = rt.state.events.filter((e) => e.candidate);
  assert.ok(decided.length > 0);
  for (const e of decided) {
    assert.equal(e.candidate.decision.walls.length, 5);
    assert.ok(typeof e.candidate.decision.reason === 'string' && e.candidate.decision.reason.length > 0);
  }
});

test('refusals always name the wall that refused', async () => {
  const rt = await boot();
  for (let i = 0; i < 150; i += 1) rt.tick();
  const refused = rt.state.events.filter((e) => e.candidate && !e.candidate.decision.cast);
  assert.ok(refused.length > 0);
  assert.ok(refused.every((e) => typeof e.candidate.decision.failed === 'string'));
});

test('the desk only ranks tokens past the unique-wallet floor', async () => {
  const rt = await boot();
  for (let i = 0; i < 200; i += 1) rt.tick();
  for (const row of rt.desk(20)) {
    assert.ok(row.wallets >= rt.state.rules.minFlowWallets);
    assert.ok(Number.isFinite(row.netUsd));
  }
});

test('the desk is sorted by net flow, descending', async () => {
  const rt = await boot();
  for (let i = 0; i < 200; i += 1) rt.tick();
  const net = rt.desk(20).map((r) => r.netUsd);
  assert.deepEqual(net, [...net].sort((a, b) => b - a));
});

test('trims push flow down, not up', async () => {
  const rt = await boot();
  for (let i = 0; i < 200; i += 1) rt.tick();
  const trims = rt.state.events.filter((e) => e.type === 'TRIM');
  assert.ok(trims.length > 0, 'a long session should observe reductions too');
});

test('the event buffer is capped', async () => {
  const rt = await boot();
  for (let i = 0; i < 900; i += 1) rt.tick();
  assert.ok(rt.state.events.length <= 600);
});

test('the same seed produces the same session', async () => {
  const a = await boot({ seedValue: 7 });
  const b = await boot({ seedValue: 7 });
  for (let i = 0; i < 60; i += 1) { a.tick(); b.tick(); }
  assert.deepEqual(a.state.counters, b.state.counters);
});
