// One-shot data refresh: reads Evan's sheet, looks every game up on Steam's
// public store API, snapshots player counts, and bakes it all into
// src/data/games-meta.json. Rerun any time with:  npm run refresh-data
//
// Console exclusives that aren't on Steam keep their palette-placeholder
// covers; their scores come from src/data/meta-overrides.json instead.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { parseSheet } = await import('../src/lib/parseSheet.js');

const SHEET_ID = '12z-CYPrVWwpWjlRc2aXoLNWh6ao4kSxVna6rDYR4aak';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Sheet titles that Steam search won't match on its own.
const SEARCH_ALIASES = {
  'hades 1 & 2': 'Hades',
  'ori blind forest & will of the wisps': 'Ori and the Will of the Wisps',
  'outerwilds': 'Outer Wilds',
  'hell divers 2': 'Helldivers 2',
  'limbo & inside': 'INSIDE',
  'steamworld heist & dig 2': 'SteamWorld Dig 2',
  'dead cells og': 'Dead Cells',
  'rathet & clank': "Ratchet & Clank: Rift Apart",
  'civilization 5': "Sid Meier's Civilization V",
  'god of war 2018 & ragnarok': 'God of War',
  'horizon foribedden ': 'Horizon Forbidden West',
  'doom eternal & dark ages': 'DOOM Eternal',
  'spiderman 1 & 2': "Marvel's Spider-Man Remastered",
  'the last of us 1 & 2': 'The Last of Us Part I',
  'jedi fallen order': 'STAR WARS Jedi: Fallen Order',
  'cyberpunk': 'Cyberpunk 2077',
  'sekiro shadows die twice': 'Sekiro: Shadows Die Twice',
  'gta v': 'Grand Theft Auto V',
  'bishock infinite': 'BioShock Infinite',
  'final fantasy 7 remake & rebirth': 'FINAL FANTASY VII REMAKE',
  'bioshock 1 & 2': 'BioShock Remastered',
  'wolfenstein 2 the new colossus': 'Wolfenstein II: The New Colossus',
  'silk song': 'Hollow Knight: Silksong',
  'paper please': 'Papers, Please',
  'doom 2017': 'DOOM',
  'tony hawks pro skater 1 & 2': "Tony Hawk's Pro Skater 1 + 2",
  'metal gear solid phantom pain': 'Metal Gear Solid V: The Phantom Pain',
  'ac black flag remaster': "Assassin's Creed IV Black Flag",
  'ac valhalla/odyssey': "Assassin's Creed Odyssey",
  'jedi survivor': 'STAR WARS Jedi: Survivor',
  'halo campaign evovled': 'Halo: The Master Chief Collection',
  'far cry 6': 'Far Cry 6',
  'black myth wukong': 'Black Myth: Wukong',
  '007 first light': '007 First Light',
  'slay the spire 2': 'Slay the Spire 2',
  'faster than light': 'FTL: Faster Than Light',
  'dk tropical freeze': null, // Nintendo exclusive
  'dk bananza': null,
  'super mario 3d world': null,
  'super mario odyssey': null,
  'super mario rpg remastered': null,
  'breath of the wild': null,
  'tears of the kingdom': null,
  'link awakening': null,
  'echoes of wisdom': null,
  'super smash bros ultimate': null,
  'mario + rabbids': null,
  'pikmin 4': null,
  'metroid dread': null,
  'metroid prime remastered': null,
  'astral chain': null,
  'advance wars': null,
  'mina the hollower': null,
  'astro bot': null, // PlayStation exclusive
  'bloodborne': null,
  'ghost of yotei': null,
  'infamous second son': null,
  'gears of war reloaded': 'Gears of War: Reloaded',
};

async function jfetch(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (pile-refresh)' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function findAppId(title) {
  const alias = SEARCH_ALIASES[title.toLowerCase()];
  if (alias === null) return null;
  const term = alias || title;
  const d = await jfetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&cc=us&l=en`);
  const items = d.items || [];
  if (!items.length) return null;
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const exact = items.find((it) => norm(it.name) === norm(term));
  return (exact || items[0]).id;
}

async function appDetails(appid) {
  const d = await jfetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us&l=en`);
  const e = d[appid];
  return e?.success ? e.data : null;
}

async function coverUrl(appid, fallback) {
  const url = `https://shared.steamstatic.com/store_item_assets/steam/apps/${appid}/library_600x900.jpg`;
  try {
    const r = await fetch(url, { method: 'HEAD' });
    if (r.ok) return url;
  } catch { /* fall through */ }
  return fallback || null;
}

async function players(appid) {
  const out = {};
  try {
    const d = await jfetch(`https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appid}`);
    if (d?.response?.result === 1) out.current = d.response.player_count;
  } catch { /* skip */ }
  try {
    const data = await jfetch(`https://steamcharts.com/app/${appid}/chart-data.json`);
    if (Array.isArray(data) && data.length > 10) {
      const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
      const recent = data.filter((p) => p[0] >= cutoff);
      const pts = recent.length >= 10 ? recent : data.slice(-720);
      const step = Math.max(1, Math.floor(pts.length / 30));
      const series = [];
      for (let i = 0; i < pts.length; i += step) {
        const chunk = pts.slice(i, i + step);
        series.push(Math.round(chunk.reduce((a, p) => a + p[1], 0) / chunk.length));
      }
      if (series.length >= 2) {
        out.series = series;
        out.peak = Math.max(...pts.map((p) => p[1]));
      }
    }
  } catch { /* skip */ }
  return Object.keys(out).length ? out : null;
}

const csv = await (await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`)).text();
const games = parseSheet(csv);
console.log(`${games.length} games in the sheet`);

const meta = {};
let hits = 0;
for (const g of games) {
  process.stdout.write(`${g.title} … `);
  try {
    const appid = await findAppId(g.title);
    if (!appid) { console.log('(not on Steam)'); await sleep(250); continue; }
    const d = await appDetails(appid);
    if (!d) { console.log('(no details)'); await sleep(1200); continue; }
    const entry = {
      appid,
      steamName: d.name,
      cover: await coverUrl(appid, d.header_image),
      metacritic: d.metacritic?.score ?? null,
      year: (d.release_date?.date || '').match(/\d{4}/)?.[0] || null,
      developer: d.developers?.[0] || null,
      genres: (d.genres || []).map((x) => x.description).slice(0, 3),
      description: d.short_description || null,
      players: await players(appid),
    };
    meta[g.id] = entry;
    hits++;
    console.log(`✓ ${appid} mc=${entry.metacritic ?? '—'} players=${entry.players?.current ?? '—'}`);
  } catch (e) {
    console.log(`error: ${e.message}`);
  }
  await sleep(1300); // stay well under Steam's rate limits
}

const out = { fetchedAt: new Date().toISOString(), games: meta };
writeFileSync(join(root, 'src/data/games-meta.json'), JSON.stringify(out, null, 1));
console.log(`\nWrote ${hits}/${games.length} entries to src/data/games-meta.json`);

// Also snapshot the sheet itself so the app is fully static.
writeFileSync(join(root, 'src/data/sheet-snapshot.csv'), csv);
console.log('Wrote src/data/sheet-snapshot.csv');
