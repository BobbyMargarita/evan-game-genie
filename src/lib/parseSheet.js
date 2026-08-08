// Parses Evan's sheet CSV. Layout (0-indexed columns):
//   1: tier labels for Indie Played   2: Indie Played titles
//   4: tier labels for AAA Played     5: AAA Played titles
//   7: Indie to Try titles            9: AAA to Try titles
// Tier labels ("Great"/"Good"/"Ok") appear once, then blank rows continue that tier.

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = ''; rows.push(row); row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const TIERS = ['Great', 'Good', 'Ok'];

export function parseSheet(csvText) {
  const rows = parseCsv(csvText);
  const games = [];
  const seen = new Set();

  const add = (title, cat, status, tier) => {
    title = (title || '').trim();
    if (!title || TIERS.includes(title)) return;
    const key = title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    games.push({ id: key.replace(/[^a-z0-9]+/g, '-'), title, cat, status, tier });
  };

  const sections = [
    { tierCol: 1, titleCol: 2, cat: 'Indie', status: 'Played' },
    { tierCol: 4, titleCol: 5, cat: 'AAA', status: 'Played' },
    { tierCol: null, titleCol: 7, cat: 'Indie', status: 'To try' },
    { tierCol: null, titleCol: 9, cat: 'AAA', status: 'To try' },
  ];

  for (const s of sections) {
    let tier = s.status === 'To try' ? 'To try' : null;
    for (let r = 1; r < rows.length; r++) {
      if (s.tierCol != null) {
        const label = (rows[r][s.tierCol] || '').trim();
        if (TIERS.includes(label)) tier = label;
      }
      if (tier) add(rows[r][s.titleCol], s.cat, s.status, tier);
    }
  }
  return games;
}
