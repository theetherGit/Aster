import { expect, test } from '@playwright/test';

/**
 * SEO and link previews (owner's request, 2026-10-19). Crawlers and link unfurlers read the
 * prerendered HTML without running scripts, so these tests read it as served.
 */
const SITE = 'https://asteruml.app';
const meta = (html: string, key: string) =>
	new RegExp(`<meta (?:name|property)="${key.replace(/[.:]/g, '\\$&')}" content="([^"]*)"`).exec(
		html
	)?.[1];

test('the welcome page carries its title, description, canonical, card and structured data', async ({
	request
}) => {
	const html = await (await request.get('/')).text();
	expect(html).toContain('<title>Aster · The open-source StarUML alternative</title>');
	const description =
		'Draw UML class diagrams in your browser. Opens and saves .mdj files, and nothing leaves your machine.';
	expect(meta(html, 'description')).toBe(description);
	expect(html).toContain(`<link rel="canonical" href="${SITE}/"`);
	expect(meta(html, 'og:type')).toBe('website');
	expect(meta(html, 'og:site_name')).toBe('Aster');
	expect(meta(html, 'og:title')).toBe('The open-source StarUML alternative');
	expect(meta(html, 'og:description')).toBe(description);
	expect(meta(html, 'og:url')).toBe(`${SITE}/`);
	expect(meta(html, 'og:image')).toBe(`${SITE}/og.png`);
	expect(meta(html, 'og:image:width')).toBe('1200');
	expect(meta(html, 'og:image:height')).toBe('630');
	expect(meta(html, 'og:image:alt')).toMatch(/^Aster: /);
	expect(meta(html, 'twitter:card')).toBe('summary_large_image');
	expect(meta(html, 'twitter:image')).toBe(`${SITE}/og.png`);
	const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1];
	expect(JSON.parse(ld!)).toMatchObject({
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: 'Aster',
		url: `${SITE}/`,
		applicationCategory: 'DesignApplication',
		offers: { '@type': 'Offer', price: '0' },
		license: 'https://opensource.org/licenses/MIT'
	});
});

test('the card image, robots.txt and sitemap.xml are served', async ({ request }) => {
	const og = await request.get('/og.png');
	expect(og.status()).toBe(200);
	expect(og.headers()['content-type']).toBe('image/png');
	const robots = await (await request.get('/robots.txt')).text();
	expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
	const sitemap = await (await request.get('/sitemap.xml')).text();
	expect(sitemap).toContain(`<loc>${SITE}/</loc>`);
	expect(sitemap).not.toContain('/design/');
});

test('the editor routes are left out of search results but still unfurl', async ({ request }) => {
	for (const path of ['/design/new', '/design/sample']) {
		const html = await (await request.get(path)).text();
		expect(meta(html, 'robots'), path).toBe('noindex');
		expect(meta(html, 'og:image'), path).toBe(`${SITE}/og.png`);
	}
});
