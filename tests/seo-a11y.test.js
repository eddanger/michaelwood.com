/**
 * Homepage SEO / accessibility basics — shipped HTML + town data only.
 * Run: bun test tests/seo-a11y.test.js
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { BUILDINGS } from '../public/js/data.js';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const robots = readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8');
const sitemap = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8');

const DESCRIPTION =
	'Woodtown — a tiny pixel town with a graffiti wall anyone can paint. Not a furniture store.';

describe('homepage meta', () => {
	test('keeps the existing description and mirrors it to Open Graph', () => {
		expect(html).toContain(`<meta name="description" content="${DESCRIPTION}">`);
		expect(html).toContain(`<meta property="og:description" content="${DESCRIPTION}">`);
		expect(html).toContain('<link rel="canonical" href="https://michaelwood.com/">');
		expect(html).toContain('<meta property="og:url" content="https://michaelwood.com/">');
	});

	test('names the canvas and graffiti wall for assistive tech', () => {
		expect(html).toContain('id="town"');
		expect(html).toContain('aria-label="Woodtown, a tiny pixel town.');
		expect(html).toContain('role="dialog"');
		expect(html).toContain('aria-live="polite"');
	});

	test('offers a noscript fallback that does not invent biography', () => {
		expect(html).toContain('<noscript>');
		expect(html).toContain(DESCRIPTION);
		expect(html).not.toMatch(/<noscript>[\s\S]*@/);
	});
});

describe('crawlers', () => {
	test('robots.txt points at the sitemap and keeps /apps out of the index', () => {
		expect(robots).toContain('Sitemap: https://michaelwood.com/sitemap.xml');
		expect(robots).toContain('Disallow: /apps');
	});

	test('sitemap lists only the public town homepage', () => {
		expect(sitemap).toContain('<loc>https://michaelwood.com/</loc>');
		expect(sitemap).not.toContain('/apps');
		expect(sitemap).not.toContain('/resume.md');
	});
});

describe('library plaque', () => {
	test('the resume the copy already names is a real plaque action', () => {
		const library = BUILDINGS.find((b) => b.id === 'library');
		expect(library.body).toContain('/resume.md');
		expect(library.action).toEqual({
			label: 'read the resume →',
			kind: 'link',
			url: '/resume.md',
		});
	});
});
