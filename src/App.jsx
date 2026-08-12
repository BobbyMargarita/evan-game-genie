import { useEffect, useMemo, useRef, useState } from 'react';
import { GAMES, detailFor, ignFor, currentlyPlaying } from './lib/staticData';
import { palFor, tierChip } from './lib/palette';
import Sparkline from './components/Sparkline';

const fmtCount = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n));

function pill(active, dashed) {
  return active
    ? {
        background: dashed ? 'var(--color-accent-2-200)' : 'var(--color-text)',
        color: dashed ? 'var(--color-accent-2-800)' : 'var(--color-bg)',
        borderColor: dashed ? 'var(--color-accent-2-600)' : 'var(--color-text)',
      }
    : { background: 'transparent', color: 'var(--color-neutral-700)', borderColor: 'var(--color-divider)' };
}

function CoverArt({ game, big }) {
  const pal = palFor(game.i);
  const detail = detailFor(game);
  const cover = detail?.cover;
  const [failed, setFailed] = useState(false);
  const showImg = cover && !failed;
  return (
    <div
      style={{
        position: 'relative', width: '100%', height: '100%', background: pal.bg,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: big ? 18 : 10, overflow: 'hidden',
      }}
    >
      {showImg ? (
        <>
          <img
            src={cover} alt="" loading="lazy" draggable="false" onError={() => setFailed(true)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%',
            background: 'linear-gradient(to top, rgba(24,20,16,.72), rgba(24,20,16,0))',
          }} />
        </>
      ) : (
        <div style={{
          position: 'absolute',
          top: big ? -70 : -26, right: big ? -60 : -26,
          width: big ? 230 : 96, height: big ? 230 : 96,
          borderRadius: 999, background: pal.blob,
        }} />
      )}
      <div style={{
        position: 'relative', fontFamily: 'var(--font-heading)',
        fontSize: big ? 34 : 17, lineHeight: 1.05,
        color: showImg ? '#f5ead8' : pal.fg,
        textShadow: showImg ? '0 1px 8px rgba(0,0,0,.5)' : 'none',
      }}>
        {game.title}
      </div>
      <TierBadge tier={game.tier} big={big} />
    </div>
  );
}

function TierBadge({ tier, big }) {
  const c = tierChip(tier);
  return (
    <div style={{
      position: 'absolute', top: big ? 14 : 8, left: big ? 14 : 8,
      background: c.bg, color: c.fg, borderRadius: 999,
      padding: big ? '4px 12px' : '3px 9px',
      font: `700 ${big ? 12 : 10.5}px var(--font-body)`, letterSpacing: '.04em',
    }}>
      {tier}
    </div>
  );
}

function ScoreCard({ label, value, denom, note }) {
  return (
    <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: '13px 14px' }}>
      <div style={{ font: '700 10.5px var(--font-body)', letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--color-neutral-700)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 5 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 32, lineHeight: 1, color: 'var(--color-accent-700)' }}>{value}</div>
        <div style={{ font: '600 11px var(--font-body)', color: 'var(--color-neutral-600)' }}>{denom}</div>
      </div>
      {note && <div style={{ font: '600 11px var(--font-body)', color: 'var(--color-neutral-700)', marginTop: 3 }}>{note}</div>}
    </div>
  );
}

function DetailSheet({ game, startRect, onClosed, onOpenGame }) {
  const sheetRef = useRef(null);
  const heroRef = useRef(null);
  const bodyRef = useRef(null);
  const detail = detailFor(game);
  const ign = ignFor(game.title);
  const steam = detail?.players || null;

  // Shared-element expand in (mode 1a "flip" from the design)
  useEffect(() => {
    const hero = heroRef.current, body = bodyRef.current;
    if (!hero || !startRect) return;
    requestAnimationFrame(() => {
      const h = hero.getBoundingClientRect();
      const s = startRect.width / h.width;
      hero.animate(
        [
          { transform: `translate(${startRect.left - h.left}px, ${startRect.top - h.top}px) scale(${s})`, borderRadius: '16px' },
          { transform: 'none', borderRadius: '28px' },
        ],
        { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)' }
      );
      body.animate(
        [{ opacity: 0, transform: 'translateY(26px)' }, { opacity: 1, transform: 'none' }],
        { duration: 480, delay: 140, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' }
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id]);

  const close = () => {
    const hero = heroRef.current, body = bodyRef.current, sheet = sheetRef.current;
    if (!hero || !startRect || !sheet) return onClosed();
    sheet.scrollTop = 0;
    setTimeout(onClosed, 380);
    requestAnimationFrame(() => {
      const h = hero.getBoundingClientRect();
      const s = startRect.width / h.width;
      hero.animate(
        [
          { transform: 'none' },
          { transform: `translate(${startRect.left - h.left}px, ${startRect.top - h.top}px) scale(${s})`, borderRadius: '16px' },
        ],
        { duration: 420, easing: 'cubic-bezier(.5,0,.2,1)' }
      );
      body.animate(
        [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(24px)' }],
        { duration: 220, easing: 'ease-in' }
      );
    });
  };

  const crumb = game.status === 'To try'
    ? `${game.cat === 'Indie' ? 'Indie Games' : 'Triple AAA'} to Try`
    : `${game.cat === 'Indie' ? 'Indie Games' : 'Triple AAA'} › ${game.tier}`;
  const mc = detail?.metacritic ?? null;
  const similar = GAMES.filter((g) => g.id !== game.id && g.cat === game.cat && g.tier === game.tier).slice(0, 5);

  return (
    <div ref={sheetRef} className="no-scrollbar" style={{ position: 'absolute', inset: 0, background: 'var(--color-bg)', overflowY: 'auto', overflowX: 'hidden' }}>
      <div ref={heroRef} style={{
        position: 'relative', margin: 'calc(env(safe-area-inset-top, 0px) + 18px) 14px 0',
        aspectRatio: '3/4', borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        transformOrigin: 'top left', boxShadow: 'var(--shadow-sm)',
      }}>
        <CoverArt game={game} big />
      </div>

      <div ref={bodyRef} style={{ padding: '0 14px 34px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '14px 0 0', font: '600 12px var(--font-body)', color: 'var(--color-neutral-700)', flexWrap: 'wrap' }}>
          {detail?.year && <span>{detail.year}</span>}
          {detail?.year && detail?.developer && <span>·</span>}
          {detail?.developer && <span>{detail.developer}</span>}
          {detail?.genres?.length > 0 && <><span>·</span><span>{detail.genres.join(', ')}</span></>}
        </div>

        <div style={{ marginTop: 14, background: 'var(--color-accent-2-200)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ font: '700 11px var(--font-body)', letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--color-accent-2-800)' }}>Evan's Rating</div>
              <div style={{ font: '600 14px var(--font-body)', color: 'var(--color-accent-2-900)', marginTop: 5 }}>{crumb}</div>
            </div>
            <div style={{ flex: 'none', background: 'var(--color-accent-2-700)', color: 'var(--color-bg)', borderRadius: 999, padding: '6px 14px', fontFamily: 'var(--font-heading)', fontSize: 15 }}>{game.tier}</div>
          </div>
        </div>

        {(mc != null || ign != null) && (
          <div style={{ display: 'grid', gridTemplateColumns: mc != null && ign != null ? '1fr 1fr' : '1fr', gap: 11, marginTop: 12 }}>
            {mc != null && <ScoreCard label="Metacritic" value={mc} denom="/100" note={mc >= 90 ? 'Universal acclaim' : 'Generally favorable'} />}
            {ign != null && <ScoreCard label="IGN" value={ign} denom="/10" note={ign >= 9 ? 'Amazing' : 'Great'} />}
          </div>
        )}

        {steam && (steam.series || steam.current != null) && (
          <div style={{ marginTop: 12, background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '14px 14px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ font: '700 10.5px var(--font-body)', letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--color-neutral-700)' }}>Steam players</div>
              <div style={{ font: '700 12px var(--font-body)' }}>
                {steam.series ? `${fmtCount(steam.peak)} peak · 30d` : `${fmtCount(steam.current)} playing`}
              </div>
            </div>
            {steam.series && <div style={{ marginTop: 8 }}><Sparkline series={steam.series} /></div>}
            {steam.series && steam.current != null && (
              <div style={{ font: '600 11px var(--font-body)', color: 'var(--color-neutral-700)', margin: '6px 0 4px' }}>{fmtCount(steam.current)} playing at last update</div>
            )}
          </div>
        )}

        {detail?.description && (
          <div style={{ marginTop: 12, background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
            <div style={{ font: '700 10.5px var(--font-body)', letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--color-neutral-700)' }}>About</div>
            <p style={{ margin: '7px 0 0', font: '400 13.5px/1.55 var(--font-body)', color: 'var(--color-neutral-800)' }}>{detail.description}</p>
          </div>
        )}

        {similar.length > 0 && (
          <>
            <div style={{ marginTop: 16, font: '700 11px var(--font-body)', letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--color-neutral-700)' }}>
              {game.status === 'To try' ? 'Sits near it in the sheet' : 'More he rated like this'}
            </div>
            <div className="no-scrollbar" style={{ display: 'flex', gap: 10, marginTop: 9, overflowX: 'auto', paddingBottom: 4 }}>
              {similar.map((s) => (
                <div key={s.id} style={{ flex: 'none', width: 104, cursor: 'pointer' }} onClick={(e) => onOpenGame(s, e)}>
                  <div style={{ width: 104, height: 139, borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                    <CoverArt game={s} />
                  </div>
                  <div style={{ font: '600 10.5px var(--font-body)', color: 'var(--color-neutral-700)', marginTop: 5 }}>
                    {s.status === 'To try' ? 'In the pile' : `Filed under ${s.tier}`}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ position: 'sticky', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 22px)', display: 'flex', padding: '0 24px', pointerEvents: 'none' }}>
        <button
          onClick={close}
          style={{
            pointerEvents: 'auto', cursor: 'pointer', border: 0,
            background: 'var(--color-text)', color: 'var(--color-bg)',
            borderRadius: 999, padding: '11px 20px',
            fontFamily: 'var(--font-heading)', fontSize: 14, boxShadow: 'var(--shadow-lg)',
          }}
        >
          ← Back to the pile
        </button>
      </div>
    </div>
  );
}

function PanelSection({ section }) {
  if (section.type === 'companions') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {section.items.map((c) => (
          <div key={c.name} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: '13px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 19, color: 'var(--color-neutral-900)' }}>{c.name}</div>
              <div style={{ flex: 'none', background: 'var(--color-accent-2-200)', color: 'var(--color-accent-2-800)', borderRadius: 999, padding: '3px 10px', font: '700 10.5px var(--font-body)', letterSpacing: '.03em' }}>{c.role}</div>
            </div>
            <div style={{ font: '600 12px var(--font-body)', color: 'var(--color-neutral-700)', marginTop: 6 }}>📍 {c.where}</div>
            <div style={{ font: '600 12px var(--font-body)', color: 'var(--color-accent-2-700)', marginTop: 6 }}>👍 {c.likes}</div>
            <div style={{ font: '600 12px var(--font-body)', color: 'var(--color-neutral-600)', marginTop: 3 }}>👎 {c.dislikes}</div>
          </div>
        ))}
      </div>
    );
  }

  if (section.type === 'tips' || section.type === 'checklist') {
    const marker = section.type === 'checklist' ? '✓' : '•';
    return (
      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: '6px 14px' }}>
        {section.items.map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid var(--color-divider)' }}>
            <div style={{ flex: 'none', color: 'var(--color-accent-700)', fontFamily: 'var(--font-heading)', fontSize: 14, lineHeight: 1.5 }}>{marker}</div>
            <div style={{ font: '400 13.5px/1.5 var(--font-body)', color: 'var(--color-neutral-800)' }}>{t}</div>
          </div>
        ))}
      </div>
    );
  }

  if (section.type === 'links') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {section.items.map((l) => (
          <a
            key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              textDecoration: 'none', borderStyle: 'dashed', borderWidth: 1, borderRadius: 'var(--radius-md)',
              padding: '13px 15px', font: '600 13px var(--font-body)', ...pill(false, true),
            }}
          >
            <span>{l.label}</span>
            <span style={{ flex: 'none', opacity: 0.6 }}>↗</span>
          </a>
        ))}
      </div>
    );
  }

  return null;
}

const MENU_BTN_COLORS = ['#8c491a', '#56633f', '#b0632f', '#3d472b', '#a5542a', '#728157', '#645c50'];

function MenuRow({ label, bg, href, onClick }) {
  const style = {
    width: '100%', minHeight: 68, cursor: 'pointer', border: 0, textDecoration: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
    background: bg, color: 'var(--color-bg)', borderRadius: 'var(--radius-md)',
    padding: '16px 18px', boxShadow: 'var(--shadow-sm)',
    fontFamily: 'var(--font-heading)', fontSize: 21, lineHeight: 1.12,
  };
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" style={style}>{label}</a>
    : <button onClick={onClick} style={style}>{label}</button>;
}

function NowPlayingPanel({ data, onClose }) {
  const sheetRef = useRef(null);
  const bodyRef = useRef(null);
  const [active, setActive] = useState(null); // null = BG3 menu, else the drilled-in section

  // Animate + reset scroll on every view change (mount, drill-in, back-to-menu)
  useEffect(() => {
    if (sheetRef.current) sheetRef.current.scrollTop = 0;
    const body = bodyRef.current;
    if (!body) return;
    body.animate(
      [{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'none' }],
      { duration: 340, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }
    );
  }, [active]);

  const close = () => {
    const body = bodyRef.current;
    if (!body) return onClose();
    setTimeout(onClose, 200);
    body.animate(
      [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(20px)' }],
      { duration: 210, easing: 'ease-in' }
    );
  };

  return (
    <div ref={sheetRef} className="no-scrollbar" style={{ position: 'absolute', inset: 0, background: 'var(--color-bg)', overflowY: 'auto', overflowX: 'hidden' }}>
      {active ? (
        <div ref={bodyRef}>
          <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 18px) 16px 0' }}>
            <div style={{ font: '700 10.5px var(--font-body)', letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>{data.title}</div>
            <h2 style={{ fontSize: 25, marginTop: 4 }}>{active.heading}</h2>
          </div>
          <div style={{ padding: '18px 16px 40px' }}>
            <PanelSection section={active} />
          </div>
        </div>
      ) : (
        <div ref={bodyRef}>
          <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 20px) 16px 0', textAlign: 'center' }}>
            <div style={{ font: '700 10.5px var(--font-body)', letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>▶ Now Playing</div>
            <h2 style={{ fontSize: 28, marginTop: 5 }}>{data.title}</h2>
            {data.tagline && <div style={{ font: '600 12.5px var(--font-body)', color: 'var(--color-neutral-700)', marginTop: 5 }}>{data.tagline}</div>}
          </div>

          {data.art && (
            <img src={data.art} alt="" draggable="false" style={{ display: 'block', width: '100%', marginTop: 10 }} />
          )}

          <div style={{ padding: '14px 16px 40px', display: 'flex', flexDirection: 'column', gap: 11 }}>
            {(() => {
              let i = 0;
              return data.sections.map((section) =>
                section.type === 'links' ? (
                  <div key={section.heading} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                    {section.label && (
                      <div style={{ font: '700 11px var(--font-body)', letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--color-neutral-600)', textAlign: 'center', margin: '6px 0 -1px' }}>{section.label}</div>
                    )}
                    {section.items.map((l) => (
                      <MenuRow key={l.url} href={l.url} label={l.label} bg={MENU_BTN_COLORS[i++ % MENU_BTN_COLORS.length]} />
                    ))}
                  </div>
                ) : (
                  <MenuRow key={section.heading} label={section.label} bg={MENU_BTN_COLORS[i++ % MENU_BTN_COLORS.length]} onClick={() => setActive(section)} />
                )
              );
            })()}
          </div>
        </div>
      )}

      <div style={{ position: 'sticky', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 22px)', display: 'flex', padding: '0 24px', pointerEvents: 'none' }}>
        <button
          onClick={active ? () => setActive(null) : close}
          style={{
            pointerEvents: 'auto', cursor: 'pointer', border: 0,
            background: 'var(--color-text)', color: 'var(--color-bg)',
            borderRadius: 999, padding: '11px 20px',
            fontFamily: 'var(--font-heading)', fontSize: 14, boxShadow: 'var(--shadow-lg)',
          }}
        >
          {active ? `← ${data.title}` : '← Back to the pile'}
        </button>
      </div>
    </div>
  );
}

const STATUSES = ['All', 'Played', 'To try'];
const CHIPS = ['Great', 'Good', 'Ok', 'Indie', 'AAA', 'Meta 90+', 'IGN 9.5+', 'Newest'];

export default function App() {
  const [status, setStatus] = useState('All');
  const [chip, setChip] = useState(null);
  const [open, setOpen] = useState(null); // { game, rect }
  const [playingOpen, setPlayingOpen] = useState(false);
  const nowPlaying = currentlyPlaying();

  const filtered = useMemo(() => {
    let list = GAMES.slice();
    if (status !== 'All') list = list.filter((g) => g.status === status);
    if (chip === 'Great' || chip === 'Good' || chip === 'Ok') list = list.filter((g) => g.tier === chip);
    if (chip === 'Indie' || chip === 'AAA') list = list.filter((g) => g.cat === chip);
    if (chip === 'Meta 90+') list = list.filter((g) => (detailFor(g)?.metacritic ?? 0) >= 90);
    if (chip === 'IGN 9.5+') list = list.filter((g) => (ignFor(g.title) ?? 0) >= 9.5);
    if (chip === 'Newest') {
      list.sort((a, b) => (Number(detailFor(b)?.year) || 0) - (Number(detailFor(a)?.year) || 0));
    }
    return list;
  }, [status, chip]);

  const openGame = (g, e) => {
    const card = e.currentTarget.querySelector('[data-cover]') || e.currentTarget.querySelector('div');
    setOpen({ game: g, rect: card ? card.getBoundingClientRect() : null });
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'var(--color-bg)' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 18px) 14px 0', display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
            <h2 style={{ fontSize: 30 }}>Evan's Game Genie</h2>
            <div className="no-scrollbar" style={{ display: 'flex', gap: 7, padding: '8px 0 6px', overflowX: 'auto' }}>
              {STATUSES.map((s) => (
                <button key={s} onClick={() => setStatus(s)} style={{
                  flex: 'none', cursor: 'pointer', borderStyle: 'solid', borderWidth: 1,
                  borderRadius: 999, padding: '7px 15px', font: '700 12.5px var(--font-body)',
                  whiteSpace: 'nowrap', ...pill(status === s),
                }}>{s}</button>
              ))}
            </div>
          </div>
          <img src={`${import.meta.env.BASE_URL}genie.png`} alt="" style={{ height: 116, alignSelf: 'flex-end', flex: 'none' }} draggable="false" />
        </div>

        {nowPlaying && (
          <button
            onClick={() => setPlayingOpen(true)}
            style={{
              margin: '4px 14px 10px', cursor: 'pointer', textAlign: 'left', border: 0,
              display: 'flex', alignItems: 'flex-end', gap: 8, overflow: 'hidden',
              background: 'var(--color-surface)', borderRadius: 'var(--radius-md)',
              padding: '0 0 0 15px', boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ flex: '0 1 auto', minWidth: 0, padding: '13px 0 15px' }}>
              <div style={{ font: '700 10px var(--font-body)', letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>▶ Now Playing</div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 19, color: 'var(--color-neutral-900)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nowPlaying.title}</div>
            </div>
            {nowPlaying.art && (
              <img src={nowPlaying.art} alt="" draggable="false" style={{ flex: '1 1 0', minWidth: 0, height: 104, objectFit: 'contain', objectPosition: 'right bottom' }} />
            )}
          </button>
        )}

        <div className="no-scrollbar" style={{ display: 'flex', gap: 7, padding: '2px 14px 10px', overflowX: 'auto' }}>
          {CHIPS.map((k) => (
            <button key={k} onClick={() => setChip(chip === k ? null : k)} style={{
              flex: 'none', cursor: 'pointer', borderStyle: 'dashed', borderWidth: 1,
              borderRadius: 999, padding: '6px 12px', font: '600 11.5px var(--font-body)',
              whiteSpace: 'nowrap', ...pill(chip === k, true),
            }}>{k}</button>
          ))}
        </div>

        <div className="no-scrollbar" style={{
          flex: 1, overflowY: 'auto', padding: '2px 14px calc(env(safe-area-inset-bottom, 0px) + 26px)',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 13px', alignContent: 'start',
        }}>
          {filtered.map((g) => {
            const detail = detailFor(g);
            return (
              <div key={g.id} onClick={(e) => openGame(g, e)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div data-cover style={{ position: 'relative', width: '100%', aspectRatio: '3/4', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  <CoverArt game={g} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ font: '700 10px var(--font-body)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--color-neutral-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.cat}</div>
                  <div style={{ font: '700 11px var(--font-body)', color: 'var(--color-accent-700)' }}>{detail?.metacritic ?? ''}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {open && (
        <DetailSheet
          key={open.game.id}
          game={open.game}
          startRect={open.rect}
          onClosed={() => setOpen(null)}
          onOpenGame={openGame}
        />
      )}

      {playingOpen && nowPlaying && (
        <NowPlayingPanel data={nowPlaying} onClose={() => setPlayingOpen(false)} />
      )}
    </div>
  );
}
