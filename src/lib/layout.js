// Which layout to show, and where everything sits in it. The page never asks what
// device it's on: the physical screen's shape tells a closed Duo (about 3:2) from a
// regular iPhone (about 2:1), and that stays true however Safari's bars change the
// window. Add ?layout=closed|phone|open|tall to the URL to force one for testing.

export function chooseLayout(w, h) {
  const forced = new URLSearchParams(window.location.search).get('layout');
  if (forced === 'closed') return { key: 'closed', phone: false };
  if (forced === 'phone') return { key: 'closed', phone: true };
  if (forced === 'open' || forced === 'tall') return { key: forced, phone: false };

  if (w > h && w >= 640) return { key: 'open', phone: false }; // Duo open flat, any phone on its side, a desktop window
  const short = Math.min(window.screen.width, window.screen.height);
  const long = Math.max(window.screen.width, window.screen.height);
  if (short >= 500) {
    if (w >= 560) return { key: 'tall', phone: false }; // Duo open and turned upright, a tablet
    return { key: 'closed', phone: h / w > 1.7 }; // a narrow desktop window: go by the window
  }
  return { key: 'closed', phone: long / short > 1.8 };
}

// A shelf's rows are as tall as a poster plus its title and scores.
function grid(inner, n) {
  const tile = (inner - (n - 1) * 10) / n;
  return { tileCols: n, rowH: Math.round((tile * 237) / 160 + 66) };
}

function closedGeom(w, h, phone, safe) {
  const top = Math.max(10, safe.top);
  const lt = h - (phone ? 190 : 128);
  const base = lt - 22;
  const k = Math.max(0.5, Math.min(phone ? 1.26 : 1, (base - top - 10) / 380, (w * 0.98) / 306));
  const fit = (x) => Math.round(x * k);
  return {
    key: 'closed', w, h, cx: w / 2, base, floor: base - 38, s: phone ? 0.9 : 0.85, ring: w * 0.55,
    heights: [fit(380), fit(380), fit(360), fit(360), Math.round(Math.min(381 * k, (w * (phone ? 0.96 : 1.05)) / 1.049))],
    lift: [0, 0, 0, fit(30), 0], fs: phone ? 34 : 32, labelR: phone ? 170 : 160, lw: w, lt,
    pl: 0, pr: 0, pt: top, pb: 0, endPad: safe.bottom, ...grid(w - 32, 3),
  };
}

function openGeom(w, h) {
  const f = h / 620;
  const lw = w / 2 - 16.5; // each side keeps clear of the hinge down the middle
  const pl = w / 2 + 16.5;
  const inner = w - pl - 12 - 36;
  return {
    key: 'open', w, h, cx: lw / 2, base: h - 130, floor: h - 160, s: 0.85 * Math.max(0.7, Math.min(1.3, f)), ring: (w / 951) * 290,
    heights: [370 * f, 370 * f, 360 * f, 370 * f, Math.min(448 * f, (lw * 1.02) / 1.049)].map(Math.round),
    lift: [0, 0, 0, Math.round(16 * f), 0], fs: 30, labelR: 170, lw, lt: h - 92,
    pl, pr: 12, pt: 12, pb: 12, ...grid(inner, Math.max(3, Math.round(inner / 140))),
  };
}

function tallGeom(w, h) {
  const f = h / 867;
  const inner = w - 24 - 36;
  return {
    key: 'tall', w, h, cx: w / 2, base: 320 * f, floor: 295 * f, s: 0.85 * Math.max(0.7, Math.min(1.3, f)), ring: (w / 669) * 300,
    heights: [290, 290, 285, 300, 300].map((x) => Math.round(x * f)),
    lift: [0, 0, 0, Math.round(6 * f), 0], fs: 30, labelR: 170, lw: w, lt: 336 * f,
    showCard: true, cardW: 230, cardH: 96, cardFs: 25,
    pl: 12, pr: 12, pt: 490 * f, pb: 12, ...grid(inner, Math.max(5, Math.round(inner / 122))),
  };
}

// Where the closed composition sits on the wide screen in the first moment after unfolding.
function openFromGeom(w, h) {
  const f = h / 620;
  return {
    key: 'openFrom', w, h, cx: w / 2, base: h - 150, floor: h - 188, s: 0.85, ring: (w / 951) * 290,
    heights: [380, 380, 360, 360, 381].map((x) => Math.round(x * f)),
    lift: [0, 0, 0, Math.round(30 * f), 0], fs: 30, labelR: 170, lw: w / 2 - 16.5, lt: h - 92,
  };
}

export function geomFor(key, phone, w, h, safe) {
  if (key === 'open') return openGeom(w, h);
  if (key === 'tall') return tallGeom(w, h);
  if (key === 'openFrom') return openFromGeom(w, h);
  return closedGeom(w, h, phone, safe);
}

// The notch and home bar, when the app is running full screen.
export function readSafeArea() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const safe = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
  probe.remove();
  return safe;
}
