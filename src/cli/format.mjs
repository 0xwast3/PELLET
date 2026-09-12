import { THEME as T } from '../config.mjs';

export const strip = (s) => String(s).replace(/\u001b\[[0-9;]*m/g, '');
export const width = (s) => strip(s).length;

export function pad(s, n, align = 'left') {
  const w = width(s);
  if (w >= n) return clip(s, n);
  const fill = ' '.repeat(n - w);
  return align === 'right' ? fill + s : align === 'center'
    ? ' '.repeat(Math.floor((n - w) / 2)) + s + ' '.repeat(Math.ceil((n - w) / 2))
    : s + fill;
}

export function clip(s, n) {
  if (width(s) <= n) return s;
  let out = '', seen = 0, i = 0;
  while (i < s.length && seen < n) {
    if (s[i] === '\u001b') {
      const end = s.indexOf('m', i);
      out += s.slice(i, end + 1); i = end + 1; continue;
    }
    out += s[i]; seen += 1; i += 1;
  }
  return out + T.reset;
}

const BARS = '▁▂▃▄▅▆▇█';
export function spark(values) {
  if (!values || values.length < 2) return '·'.repeat(6);
  const lo = Math.min(...values), hi = Math.max(...values);
  if (hi === lo) return BARS[3].repeat(values.length);
  return values.map((v) => BARS[Math.round(((v - lo) / (hi - lo)) * (BARS.length - 1))]).join('');
}

export function usd(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 'unknown';
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}k`;
  return `${sign}$${a.toFixed(0)}`;
}

export function ago(ts, now = Date.now()) {
  const s = Math.max(0, (now - ts) / 1000);
  if (s < 60) return `${s.toFixed(0)}s`;
  if (s < 3600) return `${(s / 60).toFixed(0)}m`;
  if (s < 86400) return `${(s / 3600).toFixed(0)}h`;
  return `${(s / 86400).toFixed(0)}d`;
}

export const EVENT_COLOR = {
  WAKE: T.lime, FOUND: T.bone, INFLOW: T.good, TRIM: T.bad,
  NEW: T.warn, MOVE: T.dim, CAST: T.dark, SYNC: T.dim
};

export function verdictTag(v) {
  if (v === 'CAST') return `${T.good}CAST${T.reset}`;
  if (v === 'PASS_OVER') return `${T.bad}PASS${T.reset}`;
  return `${T.dim}—${T.reset}`;
}
