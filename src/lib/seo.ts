/**
 * Where Aster lives and how it presents itself to search engines and link previews (owner's
 * request, 2026-10-19). `wrangler.jsonc` serves the build at this domain.
 */
export const SITE = 'https://asteruml.app';
export const REPO = 'https://github.com/theetherGit/Aster';
export const PUBLISHER = { name: 'EtherCorps', url: 'https://ethercorps.io' };
/** `static/og.png`, the 1200 × 630 card. */
export const OG_IMAGE = { url: `${SITE}/og.png`, width: 1200, height: 630 };

/** schema.org data for the welcome page; `<` is escaped so the JSON cannot close its script tag. */
export function jsonLd(description: string): string {
	const data = {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: 'Aster',
		url: `${SITE}/`,
		description,
		image: OG_IMAGE.url,
		applicationCategory: 'DesignApplication',
		operatingSystem: 'Any',
		browserRequirements: 'Requires JavaScript',
		isAccessibleForFree: true,
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
		license: 'https://opensource.org/licenses/MIT',
		publisher: { '@type': 'Organization', ...PUBLISHER },
		sameAs: [REPO]
	};
	return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** The welcome page's `<script type="application/ld+json">` tag, built here: a .svelte file cannot hold `</script>` in markup. */
export const jsonLdTag = (description: string) =>
	`<script type="application/ld+json">${jsonLd(description)}</script>`;
