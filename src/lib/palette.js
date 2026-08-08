// The 10-color placeholder palette from the design mockup.
export const PAL = [
  ['#8c491a', '#f5ead8', 'rgba(255,198,165,.30)'],
  ['#56633f', '#f0fae1', 'rgba(204,219,178,.32)'],
  ['#c67139', '#402310', 'rgba(255,242,235,.35)'],
  ['#2e2b25', '#eee7db', 'rgba(174,191,146,.28)'],
  ['#aebf92', '#272e1b', 'rgba(240,250,225,.45)'],
  ['#643312', '#ffe1d0', 'rgba(246,160,107,.30)'],
  ['#d67f48', '#402310', 'rgba(64,35,16,.18)'],
  ['#728157', '#f0fae1', 'rgba(225,238,204,.35)'],
  ['#474238', '#eee7db', 'rgba(192,182,165,.30)'],
  ['#b2622d', '#fff2eb', 'rgba(255,225,208,.30)'],
];

export function palFor(i) {
  const p = PAL[i % PAL.length];
  return { bg: p[0], fg: p[1], blob: p[2] };
}

export function tierChip(tier) {
  if (tier === 'Great') return { bg: 'var(--color-accent-2-700)', fg: '#f0fae1' };
  if (tier === 'Good') return { bg: 'var(--color-bg)', fg: 'var(--color-text)' };
  if (tier === 'Ok') return { bg: '#82796a', fg: '#f9f4ed' };
  return { bg: 'rgba(32,30,29,.45)', fg: '#f5ead8' }; // To try
}
