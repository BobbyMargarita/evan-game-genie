import { Component, useState } from 'react';
import { makeStage } from '../lib/smokeStage';
import { chooseLayout, geomFor, readSafeArea } from '../lib/layout';
import { SHELVES, gameTiles, mediaTiles } from '../lib/shelves';
import Sparkline from './Sparkline';

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const TONES = ['#8c491a', '#56633f', '#3d472b', '#a5542a', '#645c50', '#2e2b25'];
const CAP = 'Caprasimo, Georgia, serif';
const POSTER_RATIO = 160 / 237;

// A poster or cover. Portrait art fills the box; square or wide art sits on a blurred copy of itself instead of being cropped.
function Poster({ src, tone, alt }) {
  const [state, setState] = useState({ src: null, fit: 'cover', failed: false });
  const current = state.src === src ? state : { src, fit: 'cover', failed: false };
  const show = src && !current.failed;
  return (
    <div role={alt ? 'img' : undefined} aria-label={alt || undefined} style={{ position: 'relative', width: '100%', aspectRatio: '160 / 237', borderRadius: 12, overflow: 'hidden', background: tone }}>
      {show && current.fit === 'contain' && (
        <img src={src} alt="" draggable="false" referrerPolicy="no-referrer" style={{ position: 'absolute', inset: -14, width: 'calc(100% + 28px)', height: 'calc(100% + 28px)', objectFit: 'cover', filter: 'blur(9px)' }} />
      )}
      {show && (
        <img
          src={src} alt="" draggable="false" decoding="async" referrerPolicy="no-referrer"
          onLoad={(e) => {
            const r = e.currentTarget.naturalWidth / e.currentTarget.naturalHeight;
            setState({ src, fit: Math.abs(r - POSTER_RATIO) < 0.1 ? 'cover' : 'contain', failed: false });
          }}
          onError={() => setState({ src, fit: 'cover', failed: true })}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: current.fit }}
        />
      )}
    </div>
  );
}

function Credit({ credit, style }) {
  return (
    <div style={{ fontSize: 12, color: '#474238', ...style }}>
      Details from <a href={credit.url} target="_blank" rel="noopener noreferrer" style={{ color: '#8c491a' }}>{credit.name}</a>{credit.tail}
    </div>
  );
}

export default class Home extends Component {
  constructor(props) {
    super(props);
    const root = document.getElementById('root');
    this.vw = root.clientWidth;
    this.vh = root.clientHeight;
    this.safe = { top: 0, bottom: 0 };
    const pick = chooseLayout(this.vw, this.vh);
    this.phone = pick.phone;
    this.curKey = pick.key;
    this.state = { pos: 0, ft: 1, key: pick.key, tr: 0, br: 0, sheet: false, detail: null, sb: 0, bookStep: 0, noGL: false };
    this.items = SHELVES;
    this.pos = 0;
    this.target = 0;
    this.drag = null;
    this.justSwiped = 0;
    this.foldT = 1;
    this.foldDir = null;
    this.tr = 0;
    this.trT = 0;
    this.idleT = 0;
    this.breath = 0;
    this.filters = {};
    this.shelfData = { game: { tiles: gameTiles() } };
    this.geomCache = {};
    this.setCanvas = (el) => { if (el && !this.stage) this.stage = makeStage(this, el); };
    this.setScroller = (el) => {
      this.scroller = el;
      // coming back from a detail lands where the list was left
      if (el && this.listTop) el.scrollTop = this.listTop;
    };
    // the shelf stays in place just off screen so it can appear at once; inert keeps it out of reach while it's down
    this.setPanel = (el) => { this.panelEl = el; this.syncPanel(); };
    this.onResize = () => this.measure();
  }

  geom(key) {
    const id = key + '|' + this.phone + '|' + this.vw + '|' + this.vh + '|' + this.safe.top + '|' + this.safe.bottom;
    if (!this.geomCache[id]) this.geomCache[id] = geomFor(key, this.phone, this.vw, this.vh, this.safe);
    return this.geomCache[id];
  }

  componentDidMount() {
    this.safe = readSafeArea();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    this.measure(true);
    this.items.forEach((it) => {
      if (it.seq) it.seqImages = it.seq.map((u) => { const m = new Image(); m.src = u; return m; });
    });
    import('../data/media-meta.json').then((mod) => {
      const media = mod.default;
      this.shelfData.movie = { tiles: mediaTiles(media.movies) };
      this.shelfData.show = { tiles: mediaTiles(media.shows) };
      this.forceUpdate();
    }).catch((err) => console.error(err));
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    (this.bookTimers || []).forEach(clearTimeout);
    if (this.stage) this.stage.stop();
    this.stage = null;
  }

  componentDidUpdate() {
    this.syncPanel();
    this.syncBook();
    // swiping to another shelf closes an open detail
    if (this.state.detail && this.state.detail.shelf !== this.curShelf) this.setState({ detail: null });
    // a different shelf or filter starts back at the top
    if (this.scroller && this.scrolledKey !== this.shelfKey) {
      this.scrolledKey = this.shelfKey;
      this.scroller.scrollTop = 0;
      this.listTop = 0;
      if (this.state.sb) this.setState({ sb: 0 });
    }
  }

  // The page fills whatever the window is. A closed-to-open change plays the fold; anything else just re-lays out.
  measure(force) {
    const root = document.getElementById('root');
    const w = root.clientWidth, h = root.clientHeight;
    const pick = chooseLayout(w, h);
    const unchanged = w === this.vw && h === this.vh && pick.key === this.state.key && pick.phone === this.phone;
    if (unchanged && !force) return;
    this.vw = w;
    this.vh = h;
    this.phone = pick.phone;
    this.curKey = pick.key;
    const wasClosed = this.state.key === 'closed';
    const isClosed = pick.key === 'closed';
    if (wasClosed !== isClosed) this.fold(pick.key);
    else this.setState({ key: pick.key });
    if (this.stage) this.stage.resize();
  }

  syncPanel() {
    if (this.panelEl) this.panelEl.inert = this.state.key === 'closed' && !this.state.sheet;
  }

  // Books: the speech bubble grows one stop-motion step at a time whenever the shelf comes into view.
  syncBook() {
    const N = this.items.length;
    const p = this.state.pos;
    const it = this.items[((Math.round(p) % N) + N) % N];
    const closed = this.state.key === 'closed';
    const on = !!it.seq && Math.abs(p - Math.round(p)) < 0.12 && (closed ? (this.state.tr || 0) >= 0.7 : this.state.ft >= 0.6);
    if (on === !!this.bookOn) return;
    this.bookOn = on;
    this.playBook(on);
  }

  playBook(on) {
    (this.bookTimers || []).forEach(clearTimeout);
    this.bookTimers = [];
    if (!on) { if (this.state.bookStep) this.setState({ bookStep: 0 }); return; }
    if (this.reduced()) { this.setState({ bookStep: 3 }); return; }
    this.setState({ bookStep: 0 });
    this.bookTimers = [500, 1150, 1800].map((ms, i) => setTimeout(() => this.setState({ bookStep: i + 1 }), ms));
  }

  wrap(o) {
    const N = this.items.length;
    const m = ((o % N) + N) % N;
    return m > N / 2 ? m - N : m;
  }

  reduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  go(next) {
    this.target = next;
    if (this.reduced()) {
      this.pos = next;
      this.setState({ pos: next });
      if (this.stage) this.stage.paint();
    }
  }

  // Closed phone and iPhone: the cloud carries the word up and parts around the shelf.
  setSheet(on) {
    this.trT = on ? 1 : 0;
    this.trDone = false;
    if (on) this.opened = true;
    if (this.reduced() || this.state.noGL) {
      this.tr = this.trT;
      this.setState(on ? { sheet: true, tr: this.tr } : { sheet: false, detail: null, tr: this.tr });
      if (this.stage) this.stage.paint();
      return;
    }
    this.setState({ sheet: on });
  }

  wordWidth(t, fs) {
    if (!this.measureCtx) this.measureCtx = document.createElement('canvas').getContext('2d');
    this.measureCtx.font = fs + 'px Caprasimo';
    return this.measureCtx.measureText(t).width;
  }

  // Runs when the screen goes between closed and open: the unfolding hinge, or a phone turning on its side.
  fold(key) {
    const open = key !== 'closed';
    this.foldT = this.reduced() ? 1 : 0;
    this.foldDir = open ? 'open' : 'close';
    // folding shut while reading a detail keeps it on screen
    const keep = !open && !!this.state.detail;
    this.tr = keep ? 1 : 0;
    this.trT = this.tr;
    this.trDone = false;
    this.setState({ key, ft: this.foldT, sheet: keep, tr: this.tr });
  }

  // Only the rows near the scroll position get built, so 300 titles stay cheap.
  shelfOf(it, g, live) {
    const key = it.t + '|' + (this.filters[it.t] || '') + '|' + (this.shelfData[it.kind] ? 1 : 0) + '|' + g.key + '|' + g.tileCols + '|' + g.rowH;
    if (this.shelfKey !== key) {
      this.shelfKey = key;
      this.shelf = this.layOut(it, g);
    }
    const L = this.shelf;
    const top = (this.state.sb || 0) * g.rowH;
    return { ...L, vis: live ? L.tiles.filter((p) => p.top > top - g.rowH * 2 && p.top < top + g.rowH * 5) : [] };
  }

  layOut(it, g) {
    const n = g.tileCols;
    const d = this.shelfData[it.kind] || null;
    const isGame = it.kind === 'game';
    const list = d ? d.tiles : [];
    const statuses = [];
    list.forEach((p) => { if (!statuses.includes(p.st)) statuses.push(p.st); });
    const on = this.filters[it.t] || statuses[0];
    const chips = statuses.map((s) => ({
      s,
      label: s + ' ' + list.filter((p) => p.st === s).length,
      on: s === on,
    }));
    const shown = list.filter((p) => p.st === on);
    // what Evan has finished is grouped by how good it was; what he hasn't, by kind
    const group = shown.some((p) => p.tier) ? (p) => p.tier : (p) => p.cat;
    const names = [];
    shown.forEach((p) => { if (!names.includes(group(p))) names.push(group(p)); });
    const sections = names.map((h) => { const items = shown.filter((p) => group(p) === h); return { h, n: items.length, items }; });
    const cell = '((100% - ' + (n - 1) * 10 + 'px) / ' + n + ')';
    const heads = [], tiles = [];
    let y = 0;
    sections.forEach((s) => {
      heads.push({ h: s.h, n: s.n, y });
      y += 36;
      s.items.forEach((p, k) => {
        const col = k % n, row = Math.floor(k / n);
        const scores = (isGame ? [p.mc && 'MC ' + p.mc, p.ign && 'IGN ' + p.ign] : [p.imdb && 'IMDb ' + p.imdb, p.rt && 'RT ' + p.rt]).filter(Boolean).join(' · ');
        const tile = { src: p, top: y + row * g.rowH, x: 'calc(' + col + ' * (' + cell + ' + 10px))', scores, tone: TONES[tiles.length % TONES.length] };
        tile.open = () => { this.listTop = this.scroller ? this.scroller.scrollTop : 0; this.setState({ detail: { shelf: it.t, tile } }); };
        tiles.push(tile);
      });
      y += Math.ceil(s.items.length / n) * g.rowH + 6;
    });
    return {
      t: it.t, count: d ? list.length : '', chips, heads, tiles, tw: 'calc' + cell, credit: d ? it.credit : null, creditY: y,
      total: y + (d ? 34 : 0) + (g.endPad || 0), hasTitles: !!it.credit, seq: !!it.seq, blank: it.blank,
    };
  }

  detailOf(tile, it) {
    const p = tile.src;
    const isGame = it.kind === 'game';
    const seasons = p.se ? p.se + (String(p.se) === '1' ? ' season' : ' seasons') : null;
    const scores = (isGame
      ? [{ l: 'Metacritic', v: p.mc }, { l: 'IGN', v: p.ign }, { l: 'Steam now', v: p.now }]
      : [{ l: 'IMDb', v: p.imdb }, { l: 'Tomatometer', v: p.rt }, { l: 'Metacritic', v: p.mc }]).filter((s) => s.v);
    return {
      back: it.t,
      title: p.t,
      facts: [p.yr, p.rn, p.ra, seasons].filter(Boolean).join(' · '),
      genre: p.g,
      verdictLabel: p.tier ? "Evan's rating" : "On Evan's list",
      verdict: p.tier || p.st,
      cat: p.cat,
      scores,
      plot: p.pl,
      series: p.series,
      peak: p.peak,
      people: (isGame
        ? [{ l: 'Developer', v: p.dev }, { l: "On Evan's Xbox", v: p.xb }]
        : [{ l: 'Director', v: p.dir }, { l: it.kind === 'show' ? 'Created by' : 'Writer', v: p.wr }, { l: 'Starring', v: p.ac }]).filter((w) => w.v),
      credit: it.credit,
      poster: p.poster,
      tone: tile.tone,
    };
  }

  onDown = (e) => {
    if (e.button) return;
    const isOpen = this.state.key !== 'closed';
    // with the shelf up, a swipe down from anywhere above the list brings the wheel back
    if (!isOpen && this.state.sheet && this.tr >= 1) { this.sheetDrag = { id: e.pointerId, y0: e.clientY, locked: false }; return; }
    if (!isOpen && (this.tr > 0 || this.state.sheet)) return;
    this.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, pos0: this.pos, start: Math.round(this.pos), locked: false, lx: e.clientX, lt: e.timeStamp, v: 0 };
    this.target = this.pos;
  };

  onMove = (e) => {
    const isOpen = this.state.key !== 'closed';
    const sd = this.sheetDrag;
    if (sd && e.pointerId === sd.id) {
      const down = e.clientY - sd.y0;
      if (!sd.locked) {
        if (down < 6) return;
        sd.locked = true;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      }
      // the clouds close over the shelf as his finger comes down
      this.tr = Math.max(0.25, Math.min(1, 1 - down / 360));
      this.trT = this.tr;
      this.trDone = false;
      return;
    }
    const dr = this.drag;
    if (!dr || e.pointerId !== dr.id) return;
    const dx = e.clientX - dr.x0;
    const dy = e.clientY - dr.y0;
    // the cloud follows his finger; letting go decides whether it carries on or sinks back
    if (dr.vert) { this.tr = Math.max(0, Math.min(0.7, -dy / 360)); this.trT = this.tr; return; }
    if (!dr.locked) {
      // on the closed phone a mostly vertical drag is the swipe up, not a turn of the wheel
      if (!isOpen && Math.abs(dy) >= 6 && Math.abs(dy) > Math.abs(dx)) {
        dr.vert = true;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
        return;
      }
      if (Math.abs(dx) < 6) return;
      dr.locked = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    }
    const dt = (e.timeStamp - dr.lt) / 1000;
    if (dt > 0) dr.v = 0.6 * dr.v + 0.4 * (-(e.clientX - dr.lx) / 200 / dt);
    dr.lx = e.clientX;
    dr.lt = e.timeStamp;
    this.pos = dr.pos0 - dx / 200;
    this.target = this.pos;
  };

  onUp = (e) => {
    const sd = this.sheetDrag;
    if (sd && e.pointerId === sd.id) {
      this.sheetDrag = null;
      if (!sd.locked) return;
      this.justSwiped = performance.now();
      if (e.clientY - sd.y0 > 50) this.setSheet(false);
      else { this.trT = 1; this.trDone = false; }
      return;
    }
    const dr = this.drag;
    if (!dr || e.pointerId !== dr.id) return;
    this.drag = null;
    const p = this.pos;
    if (dr.vert) {
      this.justSwiped = performance.now();
      this.go(Math.round(p));
      if (e.clientY - dr.y0 < -50) this.setSheet(true);
      else this.trT = 0;
      return;
    }
    if (!dr.locked) { this.go(Math.round(p)); return; }
    this.justSwiped = performance.now();
    const carried = p + Math.max(-1, Math.min(1, dr.v * 0.16));
    this.go(Math.max(dr.start - 1, Math.min(dr.start + 1, Math.round(carried))));
  };

  onKey = (e) => {
    const sheet = this.state.key === 'closed' && this.state.sheet;
    const isOpen = this.state.key !== 'closed';
    if (e.key === 'Escape') {
      if (this.state.detail) this.setState({ detail: null });
      else if (sheet) this.setSheet(false);
      return;
    }
    if (sheet || this.tr > 0) return;
    if (!isOpen && e.target === e.currentTarget && (e.key === 'Enter' || e.key === 'ArrowUp')) { e.preventDefault(); this.setSheet(true); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); this.go(Math.round(this.target) + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); this.go(Math.round(this.target) - 1); }
  };

  onShelfScroll = (e) => {
    const sb = Math.floor(e.currentTarget.scrollTop / this.geom(this.state.key).rowH);
    if (sb !== (this.state.sb || 0)) this.setState({ sb });
  };

  pickFilter(it, s) {
    this.filters[it.t] = s;
    this.forceUpdate();
  }

  render() {
    const N = this.items.length;
    const { pos, ft, key, bookStep } = this.state;
    const isOpen = key !== 'closed';
    const g = this.geom(key);
    const side = 0.22;
    const nearest = ((Math.round(pos) % N) + N) % N;
    const tr = isOpen ? 0 : (this.state.tr || 0);
    const it = this.items[nearest];
    const live = isOpen || tr > 0 || this.state.sheet;
    const shelf = this.shelfOf(it, g, live);
    this.curShelf = it.t;
    const picked = this.state.detail && this.state.detail.shelf === it.t ? this.state.detail.tile : null;
    const det = picked ? this.detailOf(picked, it) : null;
    const between = Math.abs(pos - Math.round(pos));
    const settle = 1 - smooth(0.04, 0.42, between);

    // the word's flight: from the wheel to where the shelf's title sits
    const flight = Math.min(1, tr / 0.6);
    const lift = 1 - (1 - flight) * (1 - flight);
    const titleScale = 30 / g.fs;
    const titleX = tr > 0 ? 56 + (this.wordWidth(it.t, g.fs) * titleScale) / 2 - g.cx : 0;
    const travTf = 'translate(' + (titleX * lift * lift).toFixed(1) + 'px, ' + ((g.pt + 42 - (g.lt + 32)) * lift).toFixed(1) + 'px) scale(' + (1 - (1 - titleScale) * lift).toFixed(4) + ')';

    const panelOp = isOpen ? smooth(0.55, 1, ft) * (0.25 + 0.75 * settle) : 1;
    const panelTf = isOpen ? 'translateX(' + ((1 - smooth(0.55, 1, ft)) * 28).toFixed(1) + 'px)' : (tr >= 0.6 ? 'translateY(0)' : 'translateY(105%)');
    const labelOp = smooth(0.45, 1, ft);
    const wordLift = isOpen ? 0 : (this.state.br || 0) * -10;
    const hintOp = tr > 0 ? 0 : settle * (this.opened ? 0.45 : 1);

    const pickLabel = (i) => () => {
      if (performance.now() - this.justSwiped < 300) return;
      const from = Math.round(this.target);
      // tapping the word already in the middle opens its shelf
      if (!isOpen && this.wrap(i - from) === 0) { this.setSheet(true); return; }
      this.go(from + this.wrap(i - from));
    };
    const openFromHint = () => {
      if (performance.now() - this.justSwiped < 300) return;
      this.setSheet(true);
    };
    const replayBook = () => {
      if (performance.now() - this.justSwiped < 300) return;
      this.playBook(true);
    };
    const stop = (e) => e.stopPropagation();
    const pillBtn = { height: 44, border: '1px solid rgba(32,30,29,.28)', borderRadius: 999, background: 'transparent', color: '#2e2b25', fontSize: 13, fontWeight: 600, cursor: 'pointer' };

    return (
      <div
        tabIndex={0}
        aria-label="Choose a shelf. Swipe left or right, or use the arrow keys. On the closed phone, swipe up or press Enter to open it."
        onPointerDown={this.onDown} onPointerMove={this.onMove} onPointerUp={this.onUp} onPointerCancel={this.onUp} onKeyDown={this.onKey}
        style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#f5ead8', color: '#201e1d', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'grab', outline: 'none' }}
      >
        <canvas ref={this.setCanvas} role="img" aria-label={it.alt} style={{ position: 'absolute', zIndex: !isOpen && tr >= 0.5 && tr < 1 ? 2 : 0, inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }} />

        {this.state.noGL && this.items.map((p2, i) => {
          const hgt = g.heights[i];
          const wid = hgt * p2.ar;
          return <img key={p2.t} src={p2.src} alt="" draggable="false" style={{ position: 'absolute', left: g.cx - wid / 2, top: g.base - g.lift[i] - hgt, width: wid, height: hgt, opacity: Math.max(0, 1 - Math.abs(this.wrap(i - pos)) * 1.6), pointerEvents: 'none' }} />;
        })}

        {isOpen && g.showCard && (
          <div style={{ position: 'absolute', left: 12, top: 12, width: g.cardW, height: g.cardH, padding: '10px 20px', background: '#ebddc5', borderRadius: 28, display: 'flex', alignItems: 'center', opacity: smooth(0.4, 0.85, ft) }}>
            <h1 style={{ margin: 0, font: `400 ${g.cardFs}px/1.06 ${CAP}`, letterSpacing: '-.015em' }}>Evan's Game Genie</h1>
          </div>
        )}

        <div
          ref={this.setPanel}
          style={{
            position: 'absolute', zIndex: 1, left: g.pl, right: g.pr, top: g.pt, bottom: g.pb,
            padding: isOpen ? '20px 18px' : '20px 16px 0', background: '#ebddc5',
            borderRadius: isOpen ? 28 : '28px 28px 0 0', boxShadow: isOpen ? 'none' : '0 -6px 24px rgba(46,43,37,.16)',
            display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden', cursor: isOpen ? 'inherit' : 'auto',
            opacity: panelOp, transform: panelTf, willChange: 'transform',
          }}
        >
          {!isOpen && <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: 7, width: 38, height: 4, marginLeft: -19, borderRadius: 2, background: 'rgba(32,30,29,.28)' }} />}

          {!det && (
            <>
              <div style={{ display: 'flex', alignItems: isOpen ? 'baseline' : 'center', justifyContent: 'space-between', gap: 10 }}>
                {!isOpen && (
                  <button onClick={() => this.setSheet(false)} aria-label="Back to the wheel" style={{ flex: 'none', width: 44, height: 44, marginLeft: -8, marginRight: -6, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, background: 'transparent', color: '#2e2b25', cursor: 'pointer' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 9l7 7 7-7" /></svg>
                  </button>
                )}
                <h2 style={{ flex: 1, minWidth: 0, margin: 0, font: `400 30px/1.08 ${CAP}`, visibility: !isOpen && tr < 1 ? 'hidden' : 'visible' }}>{shelf.t}</h2>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#474238' }}>{shelf.count}</div>
              </div>

              {shelf.chips.length > 0 && (
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {shelf.chips.map((c) => (
                    <button key={c.s} onClick={() => this.pickFilter(it, c.s)} aria-pressed={c.on} style={{ ...pillBtn, padding: '0 14px', background: c.on ? '#2e2b25' : 'transparent', color: c.on ? '#f5ead8' : '#2e2b25' }}>{c.label}</button>
                  ))}
                </div>
              )}

              {shelf.hasTitles && (
                <div className="no-scrollbar" ref={this.setScroller} onScroll={this.onShelfScroll} onPointerDown={stop} style={{ flex: 1, minHeight: 0, position: 'relative', overflowY: 'auto', overscrollBehavior: 'contain', touchAction: 'pan-y', cursor: 'auto' }}>
                  <div style={{ position: 'relative', height: shelf.total }}>
                    {shelf.heads.map((h) => (
                      <div key={h.h} style={{ position: 'absolute', left: 0, right: 0, top: h.y, height: 30, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                        <h3 style={{ margin: 0, font: `400 21px/1.1 ${CAP}` }}>{h.h}</h3>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#474238' }}>{h.n}</div>
                      </div>
                    ))}
                    {shelf.vis.map((p) => (
                      <button key={p.src.id} onClick={p.open} style={{ position: 'absolute', left: p.x, top: p.top, width: shelf.tw, display: 'block', padding: 0, border: 0, background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                        <Poster src={p.src.poster} tone={p.tone} />
                        <div style={{ marginTop: 6, font: `400 14px/1.15 ${CAP}`, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.src.t}</div>
                        <div style={{ marginTop: 2, fontSize: 12, fontWeight: 700, color: '#474238', whiteSpace: 'nowrap' }}>{p.scores}</div>
                      </button>
                    ))}
                    {shelf.credit && <Credit credit={shelf.credit} style={{ position: 'absolute', left: 0, top: shelf.creditY }} />}
                  </div>
                </div>
              )}

              {shelf.seq && (
                <button onClick={replayBook} aria-label="A clay figure lifting a pair of sunglasses says: You should read more, Evan. Tap to play again." style={{ flex: 1, minHeight: 0, position: 'relative', display: 'block', padding: 0, border: 0, background: 'transparent', margin: isOpen ? '0 -18px -20px' : '0 -16px 0', cursor: 'pointer' }}>
                  {it.seq.map((src, i) => (
                    <img key={src} src={src} alt="" draggable="false" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center bottom', opacity: i === bookStep ? 1 : 0, pointerEvents: 'none' }} />
                  ))}
                </button>
              )}

              {shelf.blank && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px', fontSize: 16, lineHeight: 1.4, color: '#474238' }}>{shelf.blank}</div>
              )}
            </>
          )}

          {det && (
            <>
              <button onClick={() => this.setState({ detail: null })} style={{ ...pillBtn, flex: 'none', alignSelf: 'flex-start', padding: '0 16px 0 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
                {det.back}
              </button>
              <div className="no-scrollbar" onPointerDown={stop} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', touchAction: 'pan-y', cursor: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: isOpen ? 0 : (g.endPad || 0) + 20 }}>
                <div style={{ flex: 'none', display: 'flex', gap: 14 }}>
                  <div style={{ flex: 'none', width: 130 }}><Poster src={det.poster} tone={det.tone} alt={'Poster for ' + det.title} /></div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <h2 style={{ margin: 0, font: `400 25px/1.1 ${CAP}`, letterSpacing: '-.01em' }}>{det.title}</h2>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#474238' }}>{det.facts}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#474238' }}>{det.genre}</div>
                  </div>
                </div>
                <div style={{ flex: 'none', background: '#e1eecc', borderRadius: 20, padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#3d472b' }}>{det.verdictLabel}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#272e1b' }}>{det.cat}</div>
                  </div>
                  <div style={{ flex: 'none', background: '#56633f', color: '#f5ead8', borderRadius: 999, padding: '7px 16px', font: `400 16px/1 ${CAP}` }}>{det.verdict}</div>
                </div>
                {det.scores.length > 0 && (
                  <div style={{ flex: 'none', display: 'flex', gap: 8 }}>
                    {det.scores.map((s) => (
                      <div key={s.l} style={{ flex: '0 0 calc((100% - 16px) / 3)', minWidth: 0, background: '#f5ead8', borderRadius: 16, padding: '11px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.02em', textTransform: 'uppercase', color: '#474238' }}>{s.l}</div>
                        <div style={{ font: `400 26px/1 ${CAP}`, color: '#8c491a' }}>{s.v}</div>
                      </div>
                    ))}
                  </div>
                )}
                {det.series && (
                  <div style={{ flex: 'none', background: '#f5ead8', borderRadius: 16, padding: '11px 12px 8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: '.02em', textTransform: 'uppercase', color: '#474238', marginBottom: 6 }}>
                      <span>Steam players</span>{det.peak && <span>{det.peak} peak, 30 days</span>}
                    </div>
                    <Sparkline series={det.series} />
                  </div>
                )}
                {det.plot && <p style={{ flex: 'none', margin: 0, fontSize: 14.5, lineHeight: 1.5, color: '#2e2b25' }}>{det.plot}</p>}
                {det.people.map((w) => (
                  <div key={w.l} style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#474238' }}>{w.l}</div>
                    <div style={{ fontSize: 14, lineHeight: 1.35, color: '#2e2b25' }}>{w.v}</div>
                  </div>
                ))}
                {det.credit && <Credit credit={det.credit} style={{ flex: 'none', paddingBottom: 4 }} />}
              </div>
            </>
          )}
        </div>

        <div style={{ position: 'absolute', left: 0, width: g.lw, top: g.lt, height: 64, opacity: labelOp, visibility: tr >= 0.6 ? 'hidden' : 'visible', transform: `translateY(${wordLift.toFixed(1)}px)` }}>
          {this.items.map((item, i) => {
            const o = this.wrap(i - pos);
            const a = Math.abs(o);
            const t = Math.min(1, a);
            const ease = t * t * (3 - 2 * t);
            const rest = a <= 1 ? 1 + (side - 1) * ease : Math.max(0, side * (1 - (a - 1) / 0.6));
            // while travelling, the middle word is the one flying up; the others fade out
            const op = tr > 0 ? (i === nearest ? 0 : rest * (1 - smooth(0, 0.25, tr))) : rest;
            return (
              <button
                key={item.t} onClick={pickLabel(i)} aria-pressed={i === nearest}
                style={{
                  position: 'absolute', left: '50%', top: 0, width: 160, height: 64, marginLeft: -80, padding: 0, background: 'transparent', border: 0, color: '#2e2b25', cursor: 'pointer',
                  font: `400 ${g.fs}px/1 ${CAP}`, whiteSpace: 'nowrap', backfaceVisibility: 'hidden',
                  transform: `perspective(700px) translateZ(-${g.labelR}px) rotateY(${(o * 50).toFixed(2)}deg) translateZ(${g.labelR}px)`,
                  opacity: op, pointerEvents: op < 0.02 ? 'none' : 'auto',
                }}
              >{item.t}</button>
            );
          })}
          {!isOpen && (
            <button onClick={openFromHint} aria-label={'Open ' + it.t} style={{ position: 'absolute', left: '50%', top: 58, width: 88, height: 50, marginLeft: -44, padding: 0, border: 0, background: 'transparent', cursor: 'pointer', opacity: hintOp, pointerEvents: settle < 0.5 || tr > 0 ? 'none' : 'auto' }}>
              <svg className="smoke-up" style={{ position: 'absolute', left: 28, top: 22 }} width="32" height="16" viewBox="0 0 32 16" fill="none" stroke="#7a6753" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12 L16 4 L27 12" /></svg>
              <svg className="smoke-up-b" style={{ position: 'absolute', left: 28, top: 10 }} width="32" height="16" viewBox="0 0 32 16" fill="none" stroke="#7a6753" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12 L16 4 L27 12" /></svg>
            </button>
          )}
        </div>

        {!isOpen && tr > 0 && tr < 1 && (
          <div aria-hidden="true" style={{ position: 'absolute', zIndex: 3, left: 0, width: g.lw, top: g.lt, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: '#2e2b25', whiteSpace: 'nowrap', font: `400 ${g.fs}px/1 ${CAP}`, transform: travTf }}>{it.t}</div>
        )}
      </div>
    );
  }
}
