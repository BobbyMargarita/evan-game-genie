// Pulls short, spoiler-light companion intros from bg3.wiki via the
// MediaWiki TextExtracts API and bakes them into src/data/wiki-companions.json.
// Content is CC BY-SA 4.0 — the app credits bg3.wiki on screen.
// No API key needed. Rerun with:  npm run refresh-wiki

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://bg3.wiki/w/api.php';
const UA = 'EvanGameGenie/1.0 (https://github.com/BobbyMargarita/evan-game-genie; hobby fan app)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wiki page titles, kept identical to the companion names in
// src/data/currently-playing.json so the app can look them up by name.
const PAGES = ['Shadowheart', "Lae'zel", 'Astarion', 'Gale', 'Wyll', 'Karlach'];

async function jfetch(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

// First two sentences of the intro, whitespace tidied, hard length cap.
function summarize(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
  let out = sentences.slice(0, 2).join(' ').trim();
  if (out.length > 300) out = out.slice(0, 297).replace(/\s+\S*$/, '') + '…';
  return out;
}

async function extract(title) {
  const url = `${API}?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1`
    + `&titles=${encodeURIComponent(title)}&format=json&formatversion=2`;
  const d = await jfetch(url);
  const page = d?.query?.pages?.[0];
  if (!page || page.missing || !page.extract) return null;
  return { title: page.title, summary: summarize(page.extract) };
}

const pages = {};
for (const title of PAGES) {
  process.stdout.write(`${title} … `);
  try {
    const e = await extract(title);
    if (!e) { console.log('(no extract)'); await sleep(600); continue; }
    // Key by the requested title so it matches the companion name in the app.
    pages[title] = {
      title: e.title,
      summary: e.summary,
      url: `https://bg3.wiki/wiki/${encodeURIComponent(e.title.replace(/ /g, '_'))}`,
    };
    console.log(`✓ ${e.summary.length} chars`);
  } catch (err) {
    console.log(`error: ${err.message}`);
  }
  await sleep(700); // be polite to the wiki
}

const out = {
  fetchedAt: new Date().toISOString(),
  source: 'https://bg3.wiki/',
  license: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  note: 'Companion intros trimmed to 2 sentences from bg3.wiki page leads.',
  pages,
};
writeFileSync(join(root, 'src/data/wiki-companions.json'), JSON.stringify(out, null, 2));
console.log(`\nWrote ${Object.keys(pages).length}/${PAGES.length} companion intros to src/data/wiki-companions.json`);
