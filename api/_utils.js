// Shared helpers written against plain Node req/res so the same handlers run
// under both Vercel and the Vite dev-server middleware.

export function query(req) {
  return Object.fromEntries(new URL(req.url, 'http://x').searchParams);
}

export function json(res, status, data, cacheSecs = 0) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (cacheSecs) res.setHeader('Cache-Control', `s-maxage=${cacheSecs}, stale-while-revalidate=${cacheSecs * 4}`);
  res.end(JSON.stringify(data));
}
