// Lazy per-game detail fetching with localStorage + in-memory caching.

const TTL = 24 * 3600 * 1000;
const mem = new Map();
const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() { listeners.forEach((fn) => fn()); }

function lsGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (Date.now() - v.at > TTL) { localStorage.removeItem(key); return null; }
    return v.data;
  } catch { return null; }
}
function lsSet(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch { /* full */ }
}

export function getDetail(id) { return mem.get(`g:${id}`) || null; }
export function getSteam(appid) { return mem.get(`s:${appid}`) || null; }

// Small fetch queue so ~130 cover lookups don't fire at once.
const queue = [];
let active = 0;
const MAX = 4;

function pump() {
  while (active < MAX && queue.length) {
    const job = queue.shift();
    active++;
    job().finally(() => { active--; pump(); });
  }
}

function enqueue(job, front = false) {
  if (front) queue.unshift(job); else queue.push(job);
  pump();
}

const requested = new Set();

export function requestDetail(game, priority = false) {
  const key = `g:${game.id}`;
  if (mem.has(key)) return;
  const cached = lsGet(key);
  if (cached) { mem.set(key, cached); notify(); return; }
  if (requested.has(key)) return;
  requested.add(key);
  enqueue(async () => {
    try {
      const r = await fetch(`/api/game?title=${encodeURIComponent(game.title)}`);
      const data = r.ok ? await r.json() : { error: true };
      mem.set(key, data);
      if (!data.error && !data.stub) lsSet(key, data);
      notify();
    } catch {
      mem.set(key, { error: true });
      notify();
    }
  }, priority);
}

export function requestSteam(appid) {
  const key = `s:${appid}`;
  if (mem.has(key) || requested.has(key)) return;
  const cached = lsGet(key);
  if (cached) { mem.set(key, cached); notify(); return; }
  requested.add(key);
  enqueue(async () => {
    try {
      const r = await fetch(`/api/steam?appid=${appid}`);
      const data = r.ok ? await r.json() : { current: null, series: null };
      mem.set(key, data);
      if (data.current != null || data.series) lsSet(key, data);
      notify();
    } catch {
      mem.set(key, { current: null, series: null });
      notify();
    }
  }, true);
}
