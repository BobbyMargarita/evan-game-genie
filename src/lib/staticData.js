// Static data layer: everything is baked at refresh time by
// scripts/fetch-data.mjs (sheet snapshot + Steam lookups) plus two
// hand-maintained overrides files. Rerun `npm run refresh-data` to update.

import { parseSheet } from './parseSheet.js';
import sheetCsv from '../data/sheet-snapshot.csv?raw';
import metaFile from '../data/games-meta.json';
import OVERRIDES from '../data/meta-overrides.json';
import IGN from '../data/ign-overrides.json';
import NOW_PLAYING from '../data/currently-playing.json';
import WIKI_COMPANIONS from '../data/wiki-companions.json';
import XBOX from '../data/xbox-stats.json';

export const GAMES = parseSheet(sheetCsv).map((g, i) => ({ ...g, i }));
export const FETCHED_AT = new Date(metaFile.fetchedAt).getTime();

export function detailFor(game) {
  const steam = metaFile.games[game.id] || null;
  const over = OVERRIDES[game.title.toLowerCase()] || null;
  if (!steam && !over) return null;
  return { ...(steam || {}), ...(over || {}) };
}

export function ignFor(title) {
  const v = IGN[title.toLowerCase()];
  return typeof v === 'number' ? v : null;
}

// Evan's own Xbox play stats, baked from his public profile by
// scripts/fetch-xbox.mjs. Null for games he hasn't played on Xbox.
export function xboxFor(gameId) {
  return (XBOX.stats && XBOX.stats[gameId]) || null;
}

// What Evan is playing right now. Hand-maintained in currently-playing.json;
// returns null (bar hides) when no gameId is set. Falls back to the Steam
// cover baked into games-meta.json if the file doesn't carry its own.
// Baked bg3.wiki companion intros (CC BY-SA 4.0). Keyed by companion name.
export const WIKI_CREDIT = { source: WIKI_COMPANIONS.source, license: WIKI_COMPANIONS.license };
export function wikiCompanion(name) {
  return (WIKI_COMPANIONS.pages && WIKI_COMPANIONS.pages[name]) || null;
}

export function currentlyPlaying() {
  if (!NOW_PLAYING || !NOW_PLAYING.gameId) return null;
  const cover = NOW_PLAYING.cover || metaFile.games[NOW_PLAYING.gameId]?.cover || null;
  // Local art lives in public/ and must go through the GitHub Pages base path;
  // absolute (http) art is used as-is.
  const rawArt = NOW_PLAYING.art || null;
  const art = rawArt && !/^https?:/.test(rawArt) ? import.meta.env.BASE_URL + rawArt : rawArt;
  return { ...NOW_PLAYING, cover, art };
}
