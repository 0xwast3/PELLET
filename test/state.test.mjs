import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'pellet-'));
process.env.PELLET_DATA_DIR = dir;
const state = await import('../src/services/state.mjs');

after(() => rmSync(dir, { recursive: true, force: true }));

test('an empty store reads as defaults rather than throwing', () => {
  const s = state.read();
  assert.deepEqual(s.roost, []);
  assert.equal(typeof s.rules.sleepDays, 'number');
});

test('roost toggles on and off and survives a reread', () => {
  const added = state.toggleRoost('night_porter');
  assert.equal(added.roosted, true);
  assert.deepEqual(state.read().roost, ['night_porter']);
  const removed = state.toggleRoost('night_porter');
  assert.equal(removed.roosted, false);
  assert.deepEqual(state.read().roost, []);
});

test('the roost respects its limit', () => {
  for (let i = 0; i < 50; i += 1) state.toggleRoost(`w${i}`, 5);
  assert.equal(state.read().roost.length, 5);
});

test('writes land on disk atomically', () => {
  state.write({ ...state.read(), roost: ['a'] });
  assert.ok(existsSync(join(dir, 'runtime.json')));
  assert.equal(state.read().roost[0], 'a');
});
