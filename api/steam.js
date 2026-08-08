import { query, json } from './_utils.js';

// Current player count from Steam's public API plus recent history from
// steamcharts.com. History is best-effort — if steamcharts blocks or changes,
// we still return the live count and the UI draws what it gets.

export default async function handler(req, res) {
  const { appid } = query(req);
  if (!appid || !/^\d+$/.test(appid)) return json(res, 400, { error: 'numeric appid required' });

  const out = { current: null, series: null };

  try {
    const r = await fetch(
      `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appid}`
    );
    if (r.ok) {
      const d = await r.json();
      if (d?.response?.result === 1) out.current = d.response.player_count;
    }
  } catch { /* keep null */ }

  try {
    const r = await fetch(`https://steamcharts.com/app/${appid}/chart-data.json`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (game-library-app)' },
    });
    if (r.ok) {
      const data = await r.json(); // [[epochMs, players], ...]
      if (Array.isArray(data) && data.length) {
        const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
        const recent = data.filter((p) => p[0] >= cutoff);
        const pts = recent.length >= 10 ? recent : data.slice(-720);
        // Downsample to ~30 points
        const step = Math.max(1, Math.floor(pts.length / 30));
        const series = [];
        for (let i = 0; i < pts.length; i += step) {
          const chunk = pts.slice(i, i + step);
          series.push(Math.round(chunk.reduce((a, p) => a + p[1], 0) / chunk.length));
        }
        if (series.length >= 2) {
          out.series = series;
          out.peak = Math.max(...recent.length ? recent.map((p) => p[1]) : series);
        }
      }
    }
  } catch { /* keep null */ }

  return json(res, 200, out, 900);
}
