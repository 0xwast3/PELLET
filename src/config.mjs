import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, '..');

export const CHAIN = {
  id: 4663,
  name: 'Robinhood Chain',
  rpc: process.env.PELLET_RPC_URL || 'https://rpc.robinhood.com'
};

export const DATA_DIR = process.env.PELLET_DATA_DIR || join(process.cwd(), '.pellet');

/**
 * The PELLET decision box. Every wake and every inflow is pushed through
 * these five walls in order. The first wall that fails owns the refusal.
 */
export const DEFAULT_RULES = {
  sleepDays: 45,
  minDna: 55,
  sizeRatio: 0.35,
  maxImpact: 0.03,
  maxMarkAgeSec: 900,
  flowWindowMin: 60,
  minFlowWallets: 2,
  roostLimit: 40
};

/**
 * Brand palette, sampled from the mascot. 24-bit colour: the lime is the
 * product's signature and the 256-colour approximation of it is not the
 * same green.
 */
const rgb = (r, g, b) => `\u001b[38;2;${r};${g};${b}m`;

export const THEME = {
  lime: rgb(201, 249, 44),   // #c9f92c — wordmark, wakes, the owl
  glow: rgb(240, 252, 43),   // #f0fc2b — eyes, beak, highlights
  bone: rgb(222, 232, 205),  // #dee8cd — body text and handles
  dim: rgb(122, 134, 104),   // #7a8668 — labels
  dark: rgb(58, 71, 40),     // #3a4728 — rules and chrome
  good: rgb(126, 224, 129),  // #7ee081 — cleared walls, positive flow
  bad: rgb(255, 95, 82),     // #ff5f52 — refused walls, negative flow
  warn: rgb(240, 252, 43),   // #f0fc2b — unknown, synthetic
  inv: '\u001b[7m',
  bold: '\u001b[1m',
  reset: '\u001b[0m'
};

export function loadSeed() {
  return JSON.parse(readFileSync(join(ROOT, 'data', 'seed.json'), 'utf8'));
}
