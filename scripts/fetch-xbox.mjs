// Bakes Evan's public Xbox play stats (achievements, gamerscore, last played)
// into src/data/xbox-stats.json by scraping his public xboxgamertag.com page.
// Keyless — the only config is the gamertag, which stays out of this public
// repo in the untracked scripts/xbox.local.json:  { "gamertag": "..." }
// Rerun with:  npm run refresh-xbox   (also chained into npm run refresh-data)
//
// Only games on the source sheet get stats; other Xbox titles are logged and
// dropped. Achievement *totals* aren't public, so we bake unlocked counts and
// gamerscore earned/total (the site's progress % is gamerscore-based).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { parseSheet } = await import('../src/lib/parseSheet.js');

const configPath = join(root, 'scripts/xbox.local.json');
if (!existsSync(configPath)) {
  console.log('fetch-xbox: no scripts/xbox.local.json (gamertag config) — skipping Xbox stats.');
  process.exit(0);
}
const { gamertag } = JSON.parse(readFileSync(configPath, 'utf8'));
if (!gamertag) {
  console.log('fetch-xbox: xbox.local.json has no "gamertag" — skipping Xbox stats.');
  process.exit(0);
}

// Xbox title → sheet title, for names the normalizer can't line up on its own.
// (steamName from games-meta.json already bridges most renames.)
const XBOX_ALIASES = {
  'doom: the dark ages': 'doom eternal & dark ages',
};

const decode = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// Loose title key: lowercase alphanumerics only, trademark/edition noise gone.
const norm = (s) => s
  .toLowerCase()
  .replace(/\s+for xbox (series x\|s|one)\s*$/i, '')
  .replace(/[^a-z0-9]+/g, '');

// "Last played 4 months ago" → approximate ISO date, so the app can render
// its own relative phrasing that stays honest as the snapshot ages.
const UNIT_MS = { minute: 60e3, hour: 3600e3, day: 86400e3, week: 7 * 86400e3, month: 30 * 86400e3, year: 365 * 86400e3 };
function approxDate(rel) {
  const m = rel.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/i);
  if (!m) return null;
  return new Date(Date.now() - Number(m[1]) * UNIT_MS[m[2].toLowerCase()]).toISOString().slice(0, 10);
}

console.log(`Fetching public profile for the configured gamertag …`);
const r = await fetch(`https://xboxgamertag.com/search/${encodeURIComponent(gamertag)}`, {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) pile-refresh' },
});
if (!r.ok) throw new Error(`xboxgamertag.com returned ${r.status} — leaving xbox-stats.json untouched`);
const html = await r.text();

// Each game is a <div class="game-card"> with an <h3> title, a "Last played …"
// line, a "Gamerscore … N / M" row and an optional "N unlocked" achievements row.
const cards = html.split('<div class="game-card">').slice(1);
const titles = [];
for (const card of cards) {
  const title = card.match(/<h3>([^<]+)<\/h3>/)?.[1];
  if (!title) continue;
  const lastText = card.match(/Last played ([^<]+)</)?.[1]?.trim() || null;
  const gs = card.match(/Gamerscore<\/span>\s*<\/div>\s*<div[^>]*>\s*([\d,]+)\s*\/\s*([\d,]+)/);
  const ach = card.match(/Achievements<\/span>\s*<\/div>\s*<div[^>]*>\s*([\d,]+)\s*unlocked/);
  titles.push({
    name: decode(title).replace(/[™®]/g, '').trim(),
    lastPlayed: lastText ? approxDate(lastText) : null,
    gamerscoreEarned: gs ? Number(gs[1].replace(/,/g, '')) : null,
    gamerscoreTotal: gs ? Number(gs[2].replace(/,/g, '')) : null,
    achievementsEarned: ach ? Number(ach[1].replace(/,/g, '')) : null,
  });
}
if (!titles.length) throw new Error('Parsed 0 game cards — site markup changed? Leaving xbox-stats.json untouched.');
console.log(`${titles.length} Xbox titles on the profile`);

// Match against the sheet: exact normalized title, then the baked Steam name
// (bridges e.g. "Bioshock 1 & 2" → "BioShock Remastered"), then aliases.
const csv = readFileSync(join(root, 'src/data/sheet-snapshot.csv'), 'utf8');
const games = parseSheet(csv);
const metaFile = JSON.parse(readFileSync(join(root, 'src/data/games-meta.json'), 'utf8'));

const bySheetTitle = new Map(games.map((g) => [norm(g.title), g]));
const bySteamName = new Map();
for (const g of games) {
  const sn = metaFile.games[g.id]?.steamName;
  if (sn && !bySheetTitle.has(norm(sn))) bySteamName.set(norm(sn), g);
}

const stats = {};
const unmatched = [];
for (const t of titles) {
  const aliasTarget = XBOX_ALIASES[t.name.toLowerCase()];
  const g = (aliasTarget && bySheetTitle.get(norm(aliasTarget))) || bySheetTitle.get(norm(t.name)) || bySteamName.get(norm(t.name));
  if (!g) { unmatched.push(t.name); continue; }
  const prev = stats[g.id];
  // Combined sheet entries ("Doom Eternal & Dark Ages") aggregate their titles.
  stats[g.id] = prev ? {
    achievementsEarned: (prev.achievementsEarned ?? 0) + (t.achievementsEarned ?? 0),
    gamerscoreEarned: (prev.gamerscoreEarned ?? 0) + (t.gamerscoreEarned ?? 0),
    gamerscoreTotal: (prev.gamerscoreTotal ?? 0) + (t.gamerscoreTotal ?? 0),
    lastPlayed: [prev.lastPlayed, t.lastPlayed].filter(Boolean).sort().pop() || null,
    titleName: `${prev.titleName}, ${t.name}`,
  } : {
    achievementsEarned: t.achievementsEarned,
    gamerscoreEarned: t.gamerscoreEarned,
    gamerscoreTotal: t.gamerscoreTotal,
    lastPlayed: t.lastPlayed,
    titleName: t.name,
  };
  console.log(`✓ ${g.title}  ←  ${t.name}  (${t.gamerscoreEarned ?? '—'}/${t.gamerscoreTotal ?? '—'} G, last ${t.lastPlayed ?? '—'})`);
}

const out = { fetchedAt: new Date().toISOString(), stats };
writeFileSync(join(root, 'src/data/xbox-stats.json'), JSON.stringify(out, null, 1));
console.log(`\nWrote ${Object.keys(stats).length} sheet games to src/data/xbox-stats.json`);
if (unmatched.length) console.log(`Not on the sheet (ignored): ${unmatched.join(', ')}`);
const missed = games.filter((g) => !stats[g.id]);
console.log(`${missed.length} sheet games have no Xbox data (fine — other platforms).`);
