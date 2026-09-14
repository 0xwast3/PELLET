import { ask } from '../../src/services/ask.mjs';

/** POST /api/ask — the only server-side piece of the site. */
export default async (request) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'POST only' }, { status: 405 });
  }
  let payload;
  try { payload = await request.json(); }
  catch { return Response.json({ error: 'bad json' }, { status: 400 }); }

  const { status, body } = await ask(payload, Netlify.env.toObject());
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
};

export const config = { path: '/api/ask' };
