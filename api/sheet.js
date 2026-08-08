import { json } from './_utils.js';

const SHEET_ID = '12z-CYPrVWwpWjlRc2aXoLNWh6ao4kSxVna6rDYR4aak';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

export default async function handler(req, res) {
  try {
    const r = await fetch(CSV_URL, { redirect: 'follow' });
    if (!r.ok) return json(res, 502, { error: `sheet fetch failed: ${r.status}` });
    const csv = await r.text();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1200');
    res.end(csv);
  } catch (e) {
    json(res, 502, { error: String(e) });
  }
}
