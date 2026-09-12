import { getJson } from './http.mjs';

const BASE = 'https://api.dexscreener.com/latest/dex';

function normalise(pair) {
  const liq = Number(pair?.liquidity?.usd);
  const price = Number(pair?.priceUsd);
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    symbol: String(pair?.baseToken?.symbol || '').toUpperCase() || null,
    address: pair?.baseToken?.address || null,
    priceUsd: price,
    liquidityUsd: Number.isFinite(liq) ? liq : null,
    marketCapUsd: Number.isFinite(Number(pair?.marketCap)) ? Number(pair.marketCap) : null,
    volume24hUsd: Number.isFinite(Number(pair?.volume?.h24)) ? Number(pair.volume.h24) : null,
    ageHours: pair?.pairCreatedAt ? (Date.now() - pair.pairCreatedAt) / 3600000 : null,
    markedAt: Date.now()
  };
}

/** Market discovery. Returns [] rather than throwing when the source is down. */
export async function discover(query = 'robinhood') {
  const res = await getJson(`${BASE}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) return { ok: false, error: res.error, tokens: [] };
  const pairs = Array.isArray(res.data?.pairs) ? res.data.pairs : [];
  const tokens = pairs.map(normalise).filter(Boolean);
  return { ok: true, error: null, tokens };
}

export async function mark(address) {
  const res = await getJson(`${BASE}/tokens/${encodeURIComponent(address)}`);
  if (!res.ok) return { ok: false, error: res.error, token: null };
  const pairs = Array.isArray(res.data?.pairs) ? res.data.pairs : [];
  const best = pairs.map(normalise).filter(Boolean)
    .sort((a, b) => (b.liquidityUsd || 0) - (a.liquidityUsd || 0))[0] || null;
  return { ok: Boolean(best), error: best ? null : 'no pair', token: best };
}
