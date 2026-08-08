// Static data layer: everything is baked at refresh time by
// scripts/fetch-data.mjs (sheet snapshot + Steam lookups) plus two
// hand-maintained overrides files. Rerun `npm run refresh-data` to update.

import { parseSheet } from './parseSheet.js';
import sheetCsv from '../data/sheet-snapshot.csv?raw';
import metaFile from '../data/games-meta.json';
import OVERRIDES from '../data/meta-overrides.json';
import IGN from '../data/ign-overrides.json';

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
