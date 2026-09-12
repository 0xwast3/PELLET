import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR, DEFAULT_RULES } from '../config.mjs';

const FILE = () => join(DATA_DIR, 'runtime.json');

const EMPTY = { schema: 1, rules: { ...DEFAULT_RULES }, roost: [], pellets: [], updatedAt: null };

export function read() {
  try {
    if (!existsSync(FILE())) return { ...EMPTY };
    const parsed = JSON.parse(readFileSync(FILE(), 'utf8'));
    return { ...EMPTY, ...parsed, rules: { ...DEFAULT_RULES, ...(parsed.rules || {}) } };
  } catch {
    return { ...EMPTY };
  }
}

/** Atomic write: temp file then rename, so a killed process cannot truncate state. */
export function write(next) {
  mkdirSync(DATA_DIR, { recursive: true });
  const payload = { ...next, updatedAt: new Date().toISOString() };
  const tmp = `${FILE()}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(payload, null, 2));
  renameSync(tmp, FILE());
  return payload;
}

export function toggleRoost(handle, limit = DEFAULT_RULES.roostLimit) {
  const state = read();
  const at = state.roost.indexOf(handle);
  if (at >= 0) state.roost.splice(at, 1);
  else state.roost = [handle, ...state.roost].slice(0, limit);
  write(state);
  return { roosted: at < 0, roost: state.roost };
}
