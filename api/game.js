import { query, json } from './_utils.js';

// RAWG lookup: search by title, then fetch detail for developers/description/stores.
// Without RAWG_API_KEY the endpoint answers { stub: true } and the UI keeps its
// palette placeholders.

const RAWG = 'https://api.rawg.io/api';

function steamAppId(detail) {
  for (const s of detail?.stores || []) {
    const url = s?.url || '';
    const m = url.match(/store\.steampowered\.com\/app\/(\d+)/);
    if (m) return Number(m[1]);
    if (s?.store?.slug === 'steam' && detail?.slug) return null; // on Steam but URL lacks appid
  }
  return null;
}

export default async function handler(req, res) {
  const { title } = query(req);
  if (!title) return json(res, 400, { error: 'title required' });
  const key = process.env.RAWG_API_KEY;
  if (!key) return json(res, 200, { stub: true }, 3600);

  try {
    const sr = await fetch(`${RAWG}/games?key=${key}&search=${encodeURIComponent(title)}&page_size=5`);
    if (!sr.ok) return json(res, 502, { error: `rawg search ${sr.status}` });
    const search = await sr.json();
    const hit = search.results?.[0];
    if (!hit) return json(res, 200, { notFound: true }, 86400);

    const dr = await fetch(`${RAWG}/games/${hit.id}?key=${key}`);
    const detail = dr.ok ? await dr.json() : {};

    const onSteam = (detail.stores || hit.stores || []).some((s) => s?.store?.slug === 'steam');
    return json(res, 200, {
      rawgId: hit.id,
      name: hit.name,
      cover: hit.background_image || detail.background_image || null,
      metacritic: detail.metacritic ?? hit.metacritic ?? null,
      released: detail.released || hit.released || null,
      year: (detail.released || hit.released || '').slice(0, 4) || null,
      developer: detail.developers?.[0]?.name || null,
      genres: (detail.genres || hit.genres || []).map((g) => g.name).slice(0, 3),
      description: (detail.description_raw || '').split('\n')[0].slice(0, 400) || null,
      steamAppId: steamAppId(detail),
      onSteam,
    }, 86400);
  } catch (e) {
    return json(res, 502, { error: String(e) });
  }
}
