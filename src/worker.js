/**
 * michaelwood.com — Woodtown graffiti wall API.
 *
 * GET    /api/wall        → { strokes: [{ id, t, d }...] } (oldest → newest)
 * POST   /api/wall        → append one stroke { color, size, pts: [[x,y]...] }
 * DELETE /api/wall?key=…  → power-wash the wall (requires ADMIN_KEY secret)
 *
 * Anything that matches a file in /public never reaches this script.
 */

const MAX_STROKES_SERVED = 1500; // most recent strokes replayed on load
const MAX_STROKES_KEPT = 5000; // hard cap; oldest beyond this get purged
const MAX_AGE_DAYS = 60; // paint fully weathers away after this
const MAX_BODY_BYTES = 6000;
const MAX_POINTS = 300;
const RATE_LIMIT_PER_MIN = 40; // strokes per IP per minute

const JSON_HEADERS = {
	'content-type': 'application/json',
	'cache-control': 'no-store',
};

export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		if (url.pathname === '/api/wall') {
			try {
				if (request.method === 'GET') return await getWall(env);
				if (request.method === 'POST') return await postStroke(request, env);
				if (request.method === 'DELETE') return await powerWash(url, env);
				return json({ error: 'method not allowed' }, 405);
			} catch (err) {
				console.error('wall api error', err);
				return json({ error: 'something went sideways' }, 500);
			}
		}

		return new Response('Not found', { status: 404 });
	},
};

function json(obj, status = 200) {
	return new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });
}

async function getWall(env) {
	const cutoff = Date.now() - MAX_AGE_DAYS * 86400_000;
	const { results } = await env.DB.prepare(
		`SELECT id, created_at, data FROM strokes
		 WHERE created_at > ?1
		 ORDER BY id DESC LIMIT ?2`
	)
		.bind(cutoff, MAX_STROKES_SERVED)
		.all();

	const strokes = results.reverse().map((r) => ({ id: r.id, t: r.created_at, d: r.data }));
	return json({ strokes });
}

async function postStroke(request, env) {
	const body = await request.text();
	if (body.length > MAX_BODY_BYTES) return json({ error: 'stroke too big' }, 413);

	let stroke;
	try {
		stroke = JSON.parse(body);
	} catch {
		return json({ error: 'bad json' }, 400);
	}
	if (!isValidStroke(stroke)) return json({ error: 'bad stroke' }, 400);

	const ipHash = await hashIp(request.headers.get('cf-connecting-ip') || 'unknown');
	const now = Date.now();

	const recent = await env.DB.prepare(
		'SELECT COUNT(*) AS n FROM strokes WHERE ip_hash = ?1 AND created_at > ?2'
	)
		.bind(ipHash, now - 60_000)
		.first();
	if (recent.n >= RATE_LIMIT_PER_MIN) return json({ error: 'easy there, Banksy' }, 429);

	const clean = {
		color: stroke.color,
		size: stroke.size,
		pts: stroke.pts.map(([x, y]) => [Math.round(x), Math.round(y)]),
	};
	const { meta } = await env.DB.prepare(
		'INSERT INTO strokes (created_at, ip_hash, data) VALUES (?1, ?2, ?3)'
	)
		.bind(now, ipHash, JSON.stringify(clean))
		.run();

	// Occasionally sweep out weathered / over-cap strokes.
	if (meta.last_row_id % 25 === 0) {
		await env.DB.prepare(
			`DELETE FROM strokes WHERE created_at < ?1
			 OR id <= (SELECT id FROM strokes ORDER BY id DESC LIMIT 1 OFFSET ?2)`
		)
			.bind(now - MAX_AGE_DAYS * 86400_000, MAX_STROKES_KEPT)
			.run();
	}

	return json({ ok: true, id: meta.last_row_id, t: now });
}

async function powerWash(url, env) {
	if (!env.ADMIN_KEY || url.searchParams.get('key') !== env.ADMIN_KEY) {
		return json({ error: 'nope' }, 403);
	}
	await env.DB.prepare('DELETE FROM strokes').run();
	return json({ ok: true, washed: true });
}

function isValidStroke(s) {
	return (
		s &&
		typeof s.color === 'string' &&
		/^#[0-9a-f]{6}$/i.test(s.color) &&
		typeof s.size === 'number' &&
		s.size >= 2 &&
		s.size <= 64 &&
		Array.isArray(s.pts) &&
		s.pts.length >= 1 &&
		s.pts.length <= MAX_POINTS &&
		s.pts.every(
			(p) =>
				Array.isArray(p) &&
				p.length === 2 &&
				typeof p[0] === 'number' &&
				typeof p[1] === 'number' &&
				p[0] >= 0 &&
				p[0] <= 2000 &&
				p[1] >= 0 &&
				p[1] <= 1000
		)
	);
}

async function hashIp(ip) {
	const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('woodtown:' + ip));
	return [...new Uint8Array(buf.slice(0, 8))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
