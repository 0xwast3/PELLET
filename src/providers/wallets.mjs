import { getJson } from './http.mjs';
import { loadSeed } from '../config.mjs';

/**
 * Tracked wallet pool.
 *
 * Public mode returns the bootstrap pool shipped in data/seed.json.
 * With a read credential the pool is replaced by the live leaderboard mirror.
 * There is no partial merge: you always know which pool you are looking at.
 */
export async function pool() {
  const key = process.env.REPLYNODES_API_KEY;
  const bearer = process.env.FOMO_BEARER_TOKEN;
  if (!key && !bearer) {
    return { ok: true, source: 'bootstrap', error: null, wallets: loadSeed().wallets };
  }
  const headers = key ? { 'x-api-key': key } : { authorization: `Bearer ${bearer}` };
  const res = await getJson('https://api.fomo.family/v1/leaderboard?window=90d', { headers });
  if (!res.ok || !Array.isArray(res.data?.wallets)) {
    return { ok: false, source: 'bootstrap', error: res.error || 'unexpected shape', wallets: loadSeed().wallets };
  }
  const wallets = res.data.wallets.map((w) => ({
    handle: w.handle || w.address?.slice(0, 10) || 'unknown',
    address: w.address,
    dna: Number.isFinite(Number(w.score)) ? Number(w.score) : null,
    trades: Number(w.trades) || null,
    winRate: Number(w.winRate) || null,
    medianTicketEth: Number(w.medianTicketEth) || null,
    realizedEth: Number(w.realizedEth) || null,
    lastActive: w.lastActive || null,
    tags: Array.isArray(w.tags) ? w.tags : []
  })).filter((w) => w.address);
  return { ok: true, source: 'live', error: null, wallets };
}
