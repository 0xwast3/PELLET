/**
 * The analyst endpoint.
 *
 * The browser never holds a key. It posts a question plus a snapshot of what is
 * on its screen; this module builds the prompt, calls the model, and returns
 * plain text. The same file backs the Netlify function and `pellet web`, so the
 * local answer and the deployed answer come from one implementation.
 */

const API = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-5';
const MAX_QUESTION = 600;
const MAX_ROWS = 14;

export const SYSTEM = `You are the analyst pane inside PELLET, a wake terminal for Robinhood Chain.

PELLET watches tracked wallets that have gone silent. When one moves, the runtime builds a candidate and pushes it through five walls, in order, and the first wall that fails owns the refusal:
- SLEEP  dormancy >= threshold (does not apply to INFLOW candidates; reported N/A)
- EDGE   wallet DNA >= floor
- SIZE   ticket >= ratio x that wallet's own median ticket
- DEPTH  ticket / pool liquidity <= ceiling
- PRICE  mark age <= ceiling
Clearing all five is CAST. Anything else is PASS, and the refusing wall is named. Unknown inputs refuse with UNKNOWN; they never become zero.
The flow desk aggregates what cleared: net USD per token, and the count of DISTINCT tracked wallets, which is the guard against one wallet cycling a position.

Rules for your answers:
- Use only the snapshot you are given. If it does not contain the answer, say exactly what is missing.
- Never invent a wallet, token, number or event that is not in the snapshot.
- If the snapshot is marked synthetic, say so once when it matters and move on.
- You are reading data, not advising. Do not tell anyone to buy, sell, enter or exit, and do not predict price.
- Answer in plain prose, under 140 words unless asked for more. No headers, no bullet lists unless the question is genuinely a list.
- Terminal register: short sentences, concrete nouns, no hype.`;

/** Trim the client's snapshot down to something small, safe and well-shaped. */
export function buildContext(raw = {}) {
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const str = (v, n = 40) => (typeof v === 'string' ? v.slice(0, n) : null);

  return {
    mode: str(raw.mode, 20) || 'unknown',
    synthetic: raw.synthetic !== false,
    rules: raw.rules && typeof raw.rules === 'object' ? raw.rules : null,
    counters: raw.counters && typeof raw.counters === 'object' ? raw.counters : null,
    desk: Array.isArray(raw.desk) ? raw.desk.slice(0, MAX_ROWS).map((r) => ({
      symbol: str(r.symbol, 16), netUsd: num(r.netUsd), wallets: num(r.wallets), tickets: num(r.tickets)
    })) : [],
    sleepers: Array.isArray(raw.sleepers) ? raw.sleepers.slice(0, MAX_ROWS).map((w) => ({
      handle: str(w.handle, 32), days: num(w.days), dna: num(w.dna), medianTicketEth: num(w.medianTicketEth)
    })) : [],
    decisions: Array.isArray(raw.decisions) ? raw.decisions.slice(0, MAX_ROWS).map((d) => ({
      type: str(d.type, 10), handle: str(d.handle, 32), symbol: str(d.symbol, 16),
      ticketEth: num(d.ticketEth), verdict: str(d.verdict, 10), failed: str(d.failed, 10), reason: str(d.reason, 120)
    })) : [],
    focus: raw.focus && typeof raw.focus === 'object' ? {
      handle: str(raw.focus.handle, 32), dna: num(raw.focus.dna), trades: num(raw.focus.trades),
      winRate: num(raw.focus.winRate), medianTicketEth: num(raw.focus.medianTicketEth),
      realizedEth: num(raw.focus.realizedEth), dormancyDays: num(raw.focus.dormancyDays),
      cast: num(raw.focus.cast), refused: num(raw.focus.refused),
      refusedBy: raw.focus.refusedBy && typeof raw.focus.refusedBy === 'object' ? raw.focus.refusedBy : null,
      touched: Array.isArray(raw.focus.touched) ? raw.focus.touched.slice(0, 10).map((t) => str(t, 16)) : []
    } : null
  };
}

export function buildMessages(question, context) {
  const q = String(question || '').trim().slice(0, MAX_QUESTION);
  return [{
    role: 'user',
    content: `<snapshot>\n${JSON.stringify(buildContext(context), null, 1)}\n</snapshot>\n\n${q}`
  }];
}

/**
 * Returns { status, body } rather than throwing, so both callers can hand the
 * result straight back to the browser. A missing key is a 501 with an
 * explanation, not a 500 — the site is meant to work without one.
 */
export async function ask({ question, context } = {}, env = process.env) {
  const key = env.ANTHROPIC_API_KEY;
  const q = String(question || '').trim();

  // An empty question is the health probe. Report whether a key is present so
  // `doctor` cannot claim the analyst is ready when it is not.
  if (!q) return { status: 400, body: { error: 'empty question', configured: Boolean(key) } };
  if (q.length > MAX_QUESTION) {
    return { status: 400, body: { error: `question over ${MAX_QUESTION} characters`, configured: Boolean(key) } };
  }

  if (!key) {
    return {
      status: 501,
      body: {
        error: 'unconfigured',
        detail: 'The analyst needs ANTHROPIC_API_KEY on the server. Everything else on this page works without it.'
      }
    };
  }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await fetch(API, {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: env.PELLET_MODEL || DEFAULT_MODEL,
        max_tokens: 700,
        system: SYSTEM,
        messages: buildMessages(q, context)
      })
    });

    if (!res.ok) {
      const detail = res.status === 401 ? 'the server key was rejected'
        : res.status === 429 ? 'rate limited upstream — try again shortly'
        : `upstream returned ${res.status}`;
      return { status: 502, body: { error: 'upstream', detail } };
    }

    const data = await res.json();
    const text = Array.isArray(data?.content)
      ? data.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
      : '';
    if (!text) return { status: 502, body: { error: 'upstream', detail: 'empty response' } };
    return { status: 200, body: { text, model: data.model || null } };
  } catch (err) {
    const detail = err?.name === 'AbortError' ? 'timed out after 30s' : String(err?.message || err);
    return { status: 502, body: { error: 'upstream', detail } };
  } finally {
    clearTimeout(timer);
  }
}
