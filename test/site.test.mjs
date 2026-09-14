import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../src/config.mjs';

const site = (p) => join(ROOT, 'site', p);
const read = (p) => readFileSync(site(p), 'utf8');

test('the site ships the pages it links to', () => {
  for (const p of ['index.html', 'terminal.html', 'docs.html', 'how-it-works.html',
    'css/style.css', 'js/engine.js', 'js/site.js', 'js/terminal.js']) {
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
  for (const page of ['index.html', 'terminal.html', 'docs.html', 'how-it-works.html']) {
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

test('every page carries the nav links it promises', () => {
  for (const page of ['index.html', 'terminal.html', 'docs.html', 'how-it-works.html']) {
    const html = read(page);
    assert.match(html, /how-it-works\.html/, `${page} does not link How it works`);
    assert.match(html, /x\.com\/0xWast3\/status\//, `${page} does not link the X post`);
    assert.match(html, /github\.com\/0xwast3\/pellet/, `${page} does not link GitHub`);
  }
});

test('decoration is hidden from assistive tech and respects reduced motion', () => {
  const html = read('index.html');
  assert.match(html, /class="flock"[^>]*aria-hidden="true"/);
  assert.match(html, /class="marquee"[^>]*aria-hidden="true"/);
  const css = read('css/style.css');
  assert.match(css, /prefers-reduced-motion[\s\S]*?\.marquee-track \{ animation: none/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.flock \{ display: none/);
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

test('the analyst key never appears in anything the browser downloads', () => {
  for (const p of ['index.html', 'terminal.html', 'docs.html', 'how-it-works.html',
    'js/terminal.js', 'js/site.js', 'js/engine.js', 'js/walls.js']) {
    const body = read(p);
    assert.ok(!/sk-ant-/.test(body), `${p} contains something shaped like a key`);
    assert.ok(!/ANTHROPIC_API_KEY\s*[:=]\s*['"][^'"]/.test(body), `${p} assigns a key value`);
    assert.ok(!body.includes('api.anthropic.com'), `${p} calls the model API directly from the browser`);
  }
});

test('the terminal reaches the analyst through the server endpoint only', () => {
  const js = read('js/terminal.js');
  assert.match(js, /fetch\('api\/ask'/, 'the analyst is not routed through /api/ask');
});
