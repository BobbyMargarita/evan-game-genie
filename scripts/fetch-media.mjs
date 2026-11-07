// Bakes Evan's Movies and TV shows tabs + OMDb details into src/data/media-meta.json.
// Run with:  npm run refresh-media   (--cache reuses earlier OMDb answers while fixing matches)
//
// The sheet decides what's on each shelf. src/data/media-titles.json turns the sheet's
// spellings into real titles ("Claus" -> Klaus, "Dune Trilogy" -> three films).
// src/data/media-overrides.json pins a wrong match by IMDb id and can overwrite any field.
//
// The OMDb key lives only in the untracked scripts/omdb.local.json. It never goes in a log,
// in the baked file or in the app. OMDb data is CC BY-NC 4.0, so the app must credit OMDb.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'src', 'data');
const keyFile = join(here, 'omdb.local.json');
const cacheFile = join(here, 'omdb-cache.local.json');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

if (!existsSync(keyFile)) {
  console.log('No scripts/omdb.local.json, skipping OMDb bake.');
  process.exit(0);
}
const API_KEY = Object.values(readJson(keyFile))[0];

const SHEET_ID = '1DCRc7mZDKAKyYHTmxB9RkTaDkvhCsvwn2ogWLHEqJFs';
const TABS = [
  { list: 'movies', kind: 'movie', omdbType: 'movie', gid: '875704091' },
  { list: 'shows', kind: 'show', omdbType: 'series', gid: '2104523378' },
];
const THROTTLE_MS = 150;
const LOW_VOTES = 2000; // below this a yearless match is probably the wrong film

const useCache = process.argv.includes('--cache');
const cache = useCache && existsSync(cacheFile) ? readJson(cacheFile) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (s) => s.replace(/\s+/g, ' ').trim();
const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const present = (v) => (v && v !== 'N/A' ? v : null);

// RFC 4180 reader: titles with commas arrive quoted.
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

// Row 0 = status groups (blank cells carry the group across), row 1 = categories, column 0 = tier.
function readTab(rows) {
  const groups = [];
  let group = null;
  rows[0].forEach((h, col) => { if (clean(h)) group = clean(h); groups[col] = group; });
  const out = [];
  let tier = null;
  for (const row of rows.slice(2)) {
    if (clean(row[0] ?? '')) tier = clean(row[0]);
    row.forEach((cell, col) => {
      if (col === 0 || !clean(cell)) return;
      const toDo = /^to /i.test(groups[col] ?? '');
      out.push({ raw: clean(cell), status: groups[col], category: clean(rows[1][col] ?? ''), tier: toDo ? null : tier });
    });
  }
  return out;
}

let requests = 0;
async function omdb(params) {
  const id = new URLSearchParams(params).toString();
  if (cache[id]) return cache[id];
  await sleep(THROTTLE_MS);
  requests++;
  const res = await fetch(`https://www.omdbapi.com/?${new URLSearchParams({ ...params, apikey: API_KEY })}`);
  if (!res.ok) throw new Error(`OMDb answered HTTP ${res.status}`);
  const json = await res.json();
  if (json.Error && /limit|invalid api key/i.test(json.Error)) throw new Error(`OMDb stopped the bake: ${json.Error}`);
  cache[id] = json;
  return json;
}

async function lookUp(title, year, type, pinnedId) {
  if (pinnedId) return omdb({ i: pinnedId });
  if (year) {
    const hit = await omdb({ t: title, type, y: year });
    if (hit.Response === 'True') return hit;
  }
  return omdb({ t: title, type });
}

function bakeEntry(hit, sheet, wanted) {
  const score = (name) => hit.Ratings?.find((r) => r.Source === name)?.Value ?? null;
  // OMDb dates some films by their US release, so the title list's year wins for movies.
  // Shows keep OMDb's run ("2019–2025").
  const year = (wanted.kind === 'movie' && wanted.year) || present(hit.Year);
  return {
    slug: `${slugify(hit.Title)}-${String(year).slice(0, 4)}`,
    title: hit.Title,
    year,
    sheetTitle: sheet.raw,
    status: sheet.status,
    category: sheet.category,
    tier: sheet.tier,
    imdbId: hit.imdbID,
    scores: { imdb: present(hit.imdbRating), rottenTomatoes: score('Rotten Tomatoes'), metacritic: present(hit.Metascore) },
    plot: present(hit.Plot),
    genre: present(hit.Genre),
    runtime: present(hit.Runtime),
    rated: present(hit.Rated),
    director: present(hit.Director),
    writer: present(hit.Writer),
    actors: present(hit.Actors),
    seasons: present(hit.totalSeasons),
    poster: present(hit.Poster),
    ...wanted.extra,
  };
}

const titles = readJson(join(dataDir, 'media-titles.json'));
const overrides = readJson(join(dataDir, 'media-overrides.json'));
const baked = { credit: 'Details from OMDb (omdbapi.com), CC BY-NC 4.0', movies: [], shows: [] };
const flags = [];

for (const tab of TABS) {
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${tab.gid}`);
  if (!res.ok) throw new Error(`Sheet tab ${tab.list} answered HTTP ${res.status}`);
  const cells = readTab(parseCsv(await res.text()));
  const seen = new Set();
  for (const sheet of cells) {
    const mapped = titles[tab.kind][sheet.raw];
    if (!mapped) flags.push(`${tab.list}: "${sheet.raw}" not in media-titles.json, searched as typed`);
    for (const want of mapped ?? [{ title: sheet.raw, year: '' }]) {
      const override = overrides[`${tab.kind}|${want.title}|${want.year}`] ?? {};
      const { imdbId: pinned, ...extra } = override;
      const hit = await lookUp(want.title, want.year, tab.omdbType, pinned);
      if (hit.Response !== 'True') {
        flags.push(`${tab.list}: NO MATCH "${want.title}" ${want.year} (sheet: ${sheet.raw})`);
        baked[tab.list].push({ slug: slugify(want.title), title: want.title, year: want.year || null, sheetTitle: sheet.raw, status: sheet.status, category: sheet.category, tier: sheet.tier, imdbId: null, scores: { imdb: null, rottenTomatoes: null, metacritic: null }, ...extra });
        continue;
      }
      if (seen.has(hit.imdbID)) continue; // "Twin Peaks & The Return" is one show on OMDb
      seen.add(hit.imdbID);
      baked[tab.list].push(bakeEntry(hit, sheet, { extra, kind: tab.kind, year: want.year }));
      if (!pinned) {
        const votes = Number(String(hit.imdbVotes).replace(/,/g, '')) || 0;
        if (slugify(hit.Title) !== slugify(want.title)) flags.push(`${tab.list}: title differs "${want.title}" -> "${hit.Title}" (${hit.Year})`);
        if (want.year && String(hit.Year).slice(0, 4) !== String(want.year)) flags.push(`${tab.list}: year differs "${want.title}" ${want.year} -> ${hit.Year}`);
        if (votes < LOW_VOTES) flags.push(`${tab.list}: few votes (${votes}) "${hit.Title}" (${hit.Year}), sheet: ${sheet.raw}`);
      }
    }
  }
  console.log(`${tab.list}: ${baked[tab.list].length} baked from ${cells.length} sheet cells`);
}

const output = `${JSON.stringify(baked, null, 2)}\n`;
if (output.includes(API_KEY)) throw new Error('Refusing to write: the OMDb key is in the output');
writeFileSync(join(dataDir, 'media-meta.json'), output);
writeFileSync(cacheFile, JSON.stringify(cache));
console.log(`${requests} OMDb requests, ${flags.length} to check:`);
flags.forEach((f) => console.log(`  ${f}`));
