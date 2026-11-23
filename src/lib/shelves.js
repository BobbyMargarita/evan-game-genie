// The shelves on the wheel, and the tiles each one shows. Everything here is baked data;
// see CLAUDE.md for how it gets refreshed.

import { GAMES, detailFor, ignFor, xboxFor } from './staticData';

const art = (p) => import.meta.env.BASE_URL + 'art/' + p;

const compact = (n) => {
  if (n == null || n <= 0) return null;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 10000) return Math.round(n / 1000) + 'K';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
};

function xboxLine(x) {
  if (!x) return null;
  const bits = [];
  if (x.gamerscoreEarned != null && x.gamerscoreTotal) bits.push(`${x.gamerscoreEarned} of ${x.gamerscoreTotal} gamerscore`);
  if (x.achievementsEarned) bits.push(`${x.achievementsEarned} achievements`);
  if (x.lastPlayed) bits.push('last played ' + new Date(x.lastPlayed + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
  return bits.join(', ') || null;
}

export function gameTiles() {
  return GAMES.map((g) => {
    const d = detailFor(g) || {};
    const ign = ignFor(g.title);
    return {
      id: g.id,
      t: d.title || g.title,
      st: g.status,
      cat: g.cat,
      tier: g.status === 'To try' ? null : g.tier,
      poster: d.cover || null,
      yr: d.year || null,
      dev: d.developer || null,
      g: (d.genres || []).join(', ') || null,
      pl: d.description ? new DOMParser().parseFromString(d.description, 'text/html').documentElement.textContent : null,
      mc: d.metacritic ? String(d.metacritic) : null,
      ign: ign != null ? String(ign) : null,
      now: compact(d.players?.current),
      series: d.players?.series || null,
      peak: compact(d.players?.peak),
      xb: xboxLine(xboxFor(g.id)),
    };
  });
}

export function mediaTiles(list) {
  return list.map((m) => ({
    id: m.slug,
    t: m.title,
    st: m.status,
    cat: m.category,
    tier: m.tier || null,
    poster: m.poster || null,
    yr: m.year || null,
    rn: m.runtime || null,
    ra: m.rated || null,
    se: m.seasons || null,
    g: m.genre || null,
    pl: m.plot || null,
    imdb: m.scores?.imdb || null,
    rt: m.scores?.rottenTomatoes || null,
    mc: m.scores?.metacritic || null,
    dir: m.director || null,
    wr: m.writer || null,
    ac: m.actors || null,
  }));
}

const OMDB_CREDIT = { name: 'OMDb', url: 'https://www.omdbapi.com/', tail: ', CC BY-NC 4.0' };

export const SHELVES = [
  {
    t: 'Games', kind: 'game', alt: 'Two clay figures pulling paisley bandanas up over their faces', ar: 0.825, src: art('gta-04.webp'),
    frames: Array.from({ length: 5 }, (_, i) => art(`gta-${String(i).padStart(2, '0')}.webp`)),
    // swiping up into this shelf turns the smoke into a Vice City sunset, top to bottom
    palette: ['#3B146B', '#7B208F', '#C9349B', '#F36A78', '#F87572', '#FF9B55', '#FFB458'],
    credit: { name: 'Steam', url: 'https://store.steampowered.com/', tail: ' and Wikipedia' },
  },
  { t: 'Movies', kind: 'movie', alt: 'Evan as a film director', ar: 0.71, src: art('movies.webp'), mediaKey: 'movies', credit: OMDB_CREDIT },
  { t: 'TV shows', kind: 'show', alt: 'Evan in a yellow hazmat suit with a respirator', ar: 0.691, src: art('tv.webp'), mediaKey: 'shows', credit: OMDB_CREDIT },
  {
    t: 'Books', kind: 'books', alt: 'Evan writing at a desk', ar: 0.697, src: art('books.webp'),
    seq: [0, 1, 2, 3].map((i) => art(`book-${i}.webp`)),
  },
  { t: 'Music', kind: 'music', alt: 'Three DJs at the decks, one waving', ar: 1.049, src: art('music.webp'), blank: "[Evan's music list goes here]" },
];
