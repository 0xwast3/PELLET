import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ask, buildContext, buildMessages, SYSTEM } from '../src/services/ask.mjs';

test('an empty question is a probe and reports whether a key is present', async () => {
  const off = await ask({ question: '' }, {});
  assert.equal(off.status, 400);
  assert.equal(off.body.configured, false);

  const on = await ask({ question: '  ' }, { ANTHROPIC_API_KEY: 'test' });
  assert.equal(on.status, 400);
  assert.equal(on.body.configured, true, 'doctor must not be told the analyst is ready when it is not');
});

test('a missing key is 501 with an explanation, not a crash', async () => {
  const r = await ask({ question: 'what woke up?' }, {});
  assert.equal(r.status, 501);
  assert.equal(r.body.error, 'unconfigured');
  assert.match(r.body.detail, /ANTHROPIC_API_KEY/);
});

test('an oversized question is refused before any network call', async () => {
  const r = await ask({ question: 'x'.repeat(5000) }, { ANTHROPIC_API_KEY: 'test' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /over/);
});

test('the context builder drops unknown fields and coerces types', () => {
  const ctx = buildContext({
    mode: 'cached', synthetic: true, secret: 'do-not-forward',
    desk: [{ symbol: 'AI', netUsd: '1200', wallets: 3, evil: 1 }],
    sleepers: [{ handle: 'night_porter', days: 212, dna: 76 }]
  });
  assert.equal(ctx.secret, undefined, 'unknown keys must not reach the model');
  assert.equal(ctx.desk[0].evil, undefined);
  assert.equal(ctx.desk[0].netUsd, 1200, 'numeric strings are coerced');
  assert.equal(ctx.sleepers[0].handle, 'night_porter');
});

test('the context builder caps list lengths', () => {
  const many = Array.from({ length: 90 }, (_, i) => ({ symbol: 'T' + i, netUsd: i, wallets: 2 }));
  assert.ok(buildContext({ desk: many }).desk.length <= 14);
});

test('the prompt carries the snapshot and the question, and nothing else', () => {
  const msgs = buildMessages('which wall refuses most?', { mode: 'cached', desk: [] });
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].role, 'user');
  assert.match(msgs[0].content, /<snapshot>/);
  assert.match(msgs[0].content, /which wall refuses most\?/);
});

test('the system prompt forbids advice and invention', () => {
  assert.match(SYSTEM, /Do not tell anyone to buy, sell/);
  assert.match(SYSTEM, /Never invent a wallet, token, number or event/);
  assert.match(SYSTEM, /Use only the snapshot/);
});
