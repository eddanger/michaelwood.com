/**
 * Homepage identity + Woodtown a11y — shipped HTML + town data only.
 * Run: bun test tests/seo-a11y.test.js
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { BUILDINGS } from '../public/js/data.js';

const home = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const woodtown = readFileSync(new URL('../public/woodtown/index.html', import.meta.url), 'utf8');
const robots = readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8');
const sitemap = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
const llms = readFileSync(new URL('../public/llms.txt', import.meta.url), 'utf8');

const DESCRIPTION =
	'Michael Wood. A guy from the west coast of Canada. Husband, father of two, dog dad.';

const PII = /4631|53rd|604-779|Delta BC|school|password/i;

describe('homepage identity', () => {
	test('names Michael Wood and mirrors the description to Open Graph', () => {
		expect(home).toContain('<title>Michael Wood</title>');
		expect(home).toContain(`<meta name="description" content="${DESCRIPTION}">`);
		expect(home).toContain(`<meta property="og:description" content="${DESCRIPTION}">`);
		expect(home).toContain('<link rel="canonical" href="https://michaelwood.com/">');
		expect(home).toContain('<meta property="og:url" content="https://michaelwood.com/">');
	});

	test('is a short human placeholder, not a work showcase', () => {
		expect(home).toContain('A guy from the west coast of Canada.');
		expect(home).toContain('Husband, father of two, dog dad.');
		expect(home).toContain('mike@michaelwood.com');
		expect(home).not.toContain('Wemble');
		expect(home).not.toContain('Fitnito');
		expect(home).not.toContain('Fitify');
		expect(home).not.toContain('/resume.md');
		expect(home).not.toContain('github.com');
		expect(home).not.toMatch(PII);
	});

	test('does not surface Woodtown on the homepage', () => {
		expect(home).not.toContain('woodtown');
		expect(home).not.toContain('id="town"');
	});

	test('exposes Person JSON-LD for crawlers', () => {
		expect(home).toContain('"@type": "Person"');
		expect(home).toContain('"name": "Michael Wood"');
		expect(home).toContain('west coast of Canada');
		expect(home).not.toContain('jobTitle');
	});
});

describe('woodtown page', () => {
	test('lives at /woodtown/ with its own canonical', () => {
		expect(woodtown).toContain('<link rel="canonical" href="https://michaelwood.com/woodtown/">');
		expect(woodtown).toContain('id="town"');
		expect(woodtown).toContain('aria-label="Woodtown, a tiny pixel town.');
		expect(woodtown).toContain('href="/"');
		expect(woodtown).toContain('Not the bio');
	});

	test('names the canvas and graffiti wall for assistive tech', () => {
		expect(woodtown).toContain('role="dialog"');
		expect(woodtown).toContain('aria-live="polite"');
		expect(woodtown).toContain('<noscript>');
	});
});

describe('crawlers', () => {
	test('robots.txt points at the sitemap and keeps leftovers out of the index', () => {
		expect(robots).toContain('Sitemap: https://michaelwood.com/sitemap.xml');
		expect(robots).toContain('Disallow: /apps');
		expect(robots).toContain('Disallow: /resume.md');
		expect(robots).toContain('Disallow: /woodtown');
	});

	test('sitemap lists only the identity homepage', () => {
		expect(sitemap).toContain('<loc>https://michaelwood.com/</loc>');
		expect(sitemap).not.toContain('/apps');
		expect(sitemap).not.toContain('/resume.md');
		expect(sitemap).not.toContain('/woodtown');
	});

	test('llms.txt leads with the person and tucks work under Also', () => {
		expect(llms).toContain('Michael Wood');
		expect(llms).toContain('west coast of Canada');
		expect(llms).toContain('father of two');
		expect(llms).toContain('Fitnito');
		expect(llms).toContain('Fitify');
		expect(llms).toContain('Wemble');
		expect(llms).not.toContain('woodtown');
		expect(llms).not.toContain('/resume.md');
		expect(llms).not.toMatch(PII);
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
