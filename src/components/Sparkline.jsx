export default function Sparkline({ series }) {
  const w = 337, h = 84;
  const max = Math.max(...series), min = Math.min(...series);
  const range = max - min || 1;
  const pts = series.map((v, i) => [
    (i / (series.length - 1)) * w,
    h - ((v - min) / range) * (h - 10) - 4,
  ]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 84, display: 'block', overflow: 'visible' }}>
      <path d={`${line} L ${w} ${h} L 0 ${h} Z`} fill="var(--color-accent-300)" opacity="0.55" />
      <path d={line} fill="none" stroke="var(--color-accent-700)" strokeWidth="2.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="4.5" fill="var(--color-accent-700)" />
    </svg>
  );
}
