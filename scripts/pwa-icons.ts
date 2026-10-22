/**
 * The app's install icons (features.md M3, PWA) from the brand mark (docs/brand/README.md): the
 * tile is the petal violet with white petals around the amber centre. Rerun after a brand change:
 *
 *   node scripts/pwa-icons.ts
 *
 * Writes static/icons/: icon-192.png and icon-512.png (rounded tile), icon-maskable-512.png
 * (full bleed, the mark inside the maskable safe zone) and apple-touch-icon.png (iOS rounds it).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const PETAL = '#5A4BD6'; // brand: tile background
const CENTRE = '#F2B233'; // brand: centre
const OUT = new URL('../static/icons/', import.meta.url);

/** The mark (docs/brand/aster-mark.svg) in white petals, at `scale` of the tile. */
function tile(size: number, scale: number, radius: number) {
	const petals = [0, 60, 120, 180, 240, 300]
		.map((d) => `<rect x="43" y="4" width="14" height="38" rx="7" transform="rotate(${d} 50 50)"/>`)
		.join('');
	const m = size * scale;
	const o = (size - m) / 2;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
	<rect width="${size}" height="${size}" rx="${radius}" fill="${PETAL}"/>
	<svg x="${o}" y="${o}" width="${m}" height="${m}" viewBox="0 0 100 100"><g fill="#fff">${petals}</g><circle cx="50" cy="50" r="11" fill="${CENTRE}"/></svg>
</svg>`;
}

const ICONS: [name: string, size: number, scale: number, radius: number][] = [
	['icon-192.png', 192, 0.7, 192 * 0.22],
	['icon-512.png', 512, 0.7, 512 * 0.22],
	// Maskable: platforms crop to a circle of 80 % of the side; the mark stays inside it.
	['icon-maskable-512.png', 512, 0.56, 0],
	['apple-touch-icon.png', 180, 0.64, 0]
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const [name, size, scale, radius] of ICONS) {
	const page = await browser.newPage({ viewport: { width: size, height: size } });
	await page.setContent(
		`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${tile(size, scale, radius)}`
	);
	await page.screenshot({ path: new URL(name, OUT).pathname, omitBackground: true });
	await page.close();
}
await browser.close();
console.log(`wrote ${ICONS.length} icons to static/icons/`);
