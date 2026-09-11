/**
 * Origin well-known files — HTTP behavior of the asset root + worker.
 * Run: bun test tests/origin-files.test.js
 *
 * Mirrors Workers static-assets routing: a file in /public is served as-is;
 * anything else falls through to src/worker.js (wall API).
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import worker from '../src/worker.js';

const PUBLIC_ROOT = resolve(import.meta.dir, '../public');

const TYPES = {
	'.css': 'text/css;charset=utf-8',
	'.html': 'text/html;charset=utf-8',
	'.ico': 'image/x-icon',
	'.md': 'text/markdown;charset=utf-8',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.txt': 'text/plain;charset=utf-8',
	'.xml': 'application/xml;charset=utf-8',
};

function resolvePublicFile(pathname) {
	const decoded = decodeURIComponent(pathname.split('?')[0]);
	const rel = decoded.replace(/^\/+/, '');
	const candidate = rel === '' ? PUBLIC_ROOT : resolve(PUBLIC_ROOT, rel);
	if (candidate !== PUBLIC_ROOT && !candidate.startsWith(PUBLIC_ROOT + sep)) return null;

	const tryFile = (file) => {
		if (!existsSync(file)) return null;
		const st = statSync(file);
		if (st.isFile()) return file;
		if (st.isDirectory()) {
			const index = join(file, 'index.html');
			return existsSync(index) && statSync(index).isFile() ? index : null;
		}
		return null;
	};

	return tryFile(candidate) || tryFile(normalize(candidate));
}

let server;
let origin;

beforeAll(() => {
	server = Bun.serve({
		port: 0,
		async fetch(request) {
			const url = new URL(request.url);
			const file = resolvePublicFile(url.pathname);
			if (file) {
				const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
				return new Response(Bun.file(file), { headers: { 'content-type': type } });
			}
			return worker.fetch(request, {}, {});
		},
	});
	origin = `http://${server.hostname}:${server.port}`;
});

afterAll(() => {
	server.stop(true);
});

describe('crawler files at the origin', () => {
	test('robots.txt is served and keeps leftovers out of the index', async () => {
		const res = await fetch(`${origin}/robots.txt`);
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain('Sitemap: https://michaelwood.com/sitemap.xml');
		expect(body).toContain('Disallow: /apps');
		expect(body).toContain('Disallow: /resume.md');
	});

	test('sitemap.xml lists only the identity homepage', async () => {
		const res = await fetch(`${origin}/sitemap.xml`);
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain('<loc>https://michaelwood.com/</loc>');
		expect(body).not.toContain('/woodtown');
	});

	test('favicon.ico is a real icon, not a 404 or redirect', async () => {
		const res = await fetch(`${origin}/favicon.ico`, { redirect: 'manual' });
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toContain('image/x-icon');
		const buf = await res.arrayBuffer();
		expect(buf.byteLength).toBeGreaterThan(64);
	});

	test('llms.txt names Michael Wood and not the resume', async () => {
		const res = await fetch(`${origin}/llms.txt`);
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain('Michael Wood');
		expect(body).toContain('Fitnito');
		expect(body).not.toContain('/resume.md');
	});
});

describe('pages at the origin', () => {
	test('homepage is the spare bio, not Woodtown', async () => {
		const res = await fetch(`${origin}/`);
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain('<title>Michael Wood</title>');
		expect(body).toContain('Wemble Development Corporation');
		expect(body).not.toContain('id="town"');
	});

	test('Woodtown is a secondary page', async () => {
		const res = await fetch(`${origin}/woodtown/`);
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain('id="town"');
		expect(body).toContain('https://michaelwood.com/woodtown/');
	});
});
