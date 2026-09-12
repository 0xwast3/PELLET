import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, dormancyDays, WALL_ORDER, ruleSheet } from '../src/cli/rules.mjs';
import { DEFAULT_RULES } from '../src/config.mjs';

const NOW = Date.parse('2026-09-12T00:00:00Z');
const wallet = (over = {}) => ({
  handle: 'test', dna: 70, medianTicketEth: 0.5,
  lastActive: new Date(NOW - 200 * 86400000).toISOString(), ...over
});
const token = (over = {}) => ({ symbol: 'X', priceUsd: 0.01, liquidityUsd: 500000, ...over });
const cand = (over = {}) => ({
  wallet: wallet(), token: token(), ticketEth: 1, ticketUsd: 3100, markAgeSec: 30, kind: 'WAKE', ...over
});

test('a clean wake clears every wall', () => {
  const d = evaluate(cand(), DEFAULT_RULES, NOW);
  assert.equal(d.verdict, 'CAST');
  assert.equal(d.failed, null);
  assert.deepEqual(d.walls.map((w) => w.name), WALL_ORDER);
});

test('the first failing wall owns the refusal', () => {
  const d = evaluate(cand({ wallet: wallet({ dna: 20 }), ticketEth: 0.001, ticketUsd: 3 }), DEFAULT_RULES, NOW);
  assert.equal(d.verdict, 'PASS_OVER');
  assert.equal(d.failed, 'EDGE', 'EDGE precedes SIZE and must own the refusal');
  assert.match(d.reason, /EDGE/);
});

test('SLEEP does not apply to an inflow candidate and is reported as N/A', () => {
  const d = evaluate(cand({ kind: 'INFLOW', wallet: wallet({ lastActive: new Date(NOW).toISOString() }) }), DEFAULT_RULES, NOW);
  assert.equal(d.walls[0].state, 'N/A');
  assert.equal(d.verdict, 'CAST');
});

test('a short sleep is refused by SLEEP', () => {
  const w = wallet({ lastActive: new Date(NOW - 3 * 86400000).toISOString() });
  const d = evaluate(cand({ wallet: w }), DEFAULT_RULES, NOW);
  assert.equal(d.failed, 'SLEEP');
});

test('unknown never becomes zero', () => {
  const d = evaluate(cand({ token: token({ liquidityUsd: 0 }), ticketUsd: NaN }), DEFAULT_RULES, NOW);
  const depth = d.walls.find((w) => w.name === 'DEPTH');
  assert.equal(depth.state, 'UNKNOWN');
  assert.equal(depth.shown, '—');
  assert.equal(d.verdict, 'PASS_OVER');
});

test('a stale mark is refused by PRICE', () => {
  const d = evaluate(cand({ markAgeSec: DEFAULT_RULES.maxMarkAgeSec + 1 }), DEFAULT_RULES, NOW);
  assert.equal(d.failed, 'PRICE');
});

test('a ticket too small for the wallet is refused by SIZE', () => {
  const d = evaluate(cand({ ticketEth: 0.01 }), DEFAULT_RULES, NOW);
  assert.equal(d.failed, 'SIZE');
});

test('a ticket too large for the pool is refused by DEPTH', () => {
  const d = evaluate(cand({ ticketUsd: 400000 }), DEFAULT_RULES, NOW);
  assert.equal(d.failed, 'DEPTH');
});

test('dormancy is null when the wallet has no last-active stamp', () => {
  assert.equal(dormancyDays({ lastActive: null }, NOW), null);
});

test('the rule sheet covers every wall', () => {
  assert.deepEqual(ruleSheet().map((r) => r[0]), WALL_ORDER);
});
