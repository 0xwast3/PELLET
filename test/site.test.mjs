import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../src/config.mjs';

const site = (p) => join(ROOT, 'site', p);
const read = (p) => readFileSync(site(p), 'utf8');

test('the site ships the pages it links to', () => {
  for (const p of ['index.html', 'terminal.html', 'docs.html', 'css/style.css',
    'js/engine.js', 'js/site.js', 'js/terminal.js']) {
    assert.ok(existsSync(site(p)), `missing ${p}`);
  }
});

test('the generated wall logic matches the source it was copied from', () => {
  const source = readFileSync(join(ROOT, 'src', 'core', 'walls.mjs'), 'utf8');
  const copy = read('js/walls.js');
  assert.ok(copy.startsWith('/* GENERATED'), 'the copy must announce that it is generated');
  assert.equal(copy.slice(copy.indexOf('\n') + 1), source,
    'site/js/walls.js is stale — run `npm run site`');
});

test('the generated bootstrap set matches the source', () => {
  const source = JSON.parse(readFileSync(join(ROOT, 'data', 'seed.json'), 'utf8'));
  assert.deepEqual(JSON.parse(read('data/seed.json')), source, 'site/data/seed.json is stale — run `npm run site`');
});

test('nothing on the site calls out to a third party', () => {
  for (const page of ['index.html', 'terminal.html', 'docs.html']) {
    const html = read(page);
    for (const host of ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'unpkg.com', 'googletagmanager']) {
      assert.ok(!html.includes(host), `${page} still references ${host}`);
    }
  }
});

test('the fonts are self-hosted with their licences', () => {
  for (const f of ['fonts/jetbrains-mono-400.woff2', 'fonts/pixelify-sans-400.woff2',
    'fonts/JetBrainsMono-OFL.txt', 'fonts/PixelifySans-OFL.txt']) {
    assert.ok(existsSync(site(f)), `missing ${f}`);
  }
  assert.match(read('css/style.css'), /@font-face/);
});

test('every page states that nothing here signs anything', () => {
  for (const page of ['index.html', 'terminal.html', 'docs.html']) {
    assert.match(read(page), /no wallet connect|not sign|no signing/i, `${page} omits the safety line`);
  }
});

test('the synthetic label is present wherever the engine renders', () => {
  assert.match(read('js/site.js'), /Synthetic/);
  assert.match(read('js/terminal.js'), /synthetic/);
  assert.match(read('js/engine.js'), /synthetic: true/);
});
