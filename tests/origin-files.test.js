/**
 * Origin well-known files — HTTP behavior of the asset root + worker.
 * Run: bun test tests/origin-files.test.js
 *
 * Mirrors Workers static-assets routing: a file in /public is served as-is;
 * anything else falls through to src/worker.js (wall API + favicon redirect).
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import worker from '../src/worker.js';

const PUBLIC_ROOT = resolve(import.meta.dir, '../public');

const TYPES = {
	'.html': 'text/html;charset=utf-8',
	'.md': 'text/markdown;charset=utf-8',
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
	test('robots.txt is served and keeps /apps out of the index', async () => {
		const res = await fetch(`${origin}/robots.txt`);
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain('Sitemap: https://michaelwood.com/sitemap.xml');
		expect(body).toContain('Disallow: /apps');
	});

	test('sitemap.xml lists the public town homepage', async () => {
		const res = await fetch(`${origin}/sitemap.xml`);
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain('<loc>https://michaelwood.com/</loc>');
	});

	test('favicon.ico redirects to the existing house-emoji SVG', async () => {
		const res = await fetch(`${origin}/favicon.ico`, { redirect: 'manual' });
		expect(res.status).toBe(301);
		expect(new URL(res.headers.get('location'), origin).pathname).toBe('/favicon.svg');

		const svg = await fetch(`${origin}/favicon.svg`);
		expect(svg.status).toBe(200);
		expect(await svg.text()).toContain('🏘️');
	});

	test('llms.txt points at the existing public URLs', async () => {
		const res = await fetch(`${origin}/llms.txt`);
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain('https://michaelwood.com/');
		expect(body).toContain('https://michaelwood.com/resume.md');
	});

	test('homepage and resume stay reachable', async () => {
		const home = await fetch(`${origin}/`);
		expect(home.status).toBe(200);
		expect(await home.text()).toContain('href="/favicon.svg"');

		const resume = await fetch(`${origin}/resume.md`);
		expect(resume.status).toBe(200);
	});
});
