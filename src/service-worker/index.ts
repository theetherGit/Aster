/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * Offline (features.md M3, PWA): every file of this build is cached on install, the PDF engine's
 * WASM included, so after one visit Aster opens, edits, saves and exports with no network.
 *
 * - Built files are immutable: served from the cache first.
 * - Pages are fetched from the network first, so a deploy shows at once; offline, the cached page
 *   answers, and `/design/<slug>` gets the editor shell (adapter-static's 404.html, which loads
 *   the editor on the client, as Cloudflare serves it).
 * - `/docs` and `/.well-known` belong to the docs' own Worker (docs-site/wrangler.jsonc): never
 *   answered here, so the app's shell can never stand in for a docs page.
 * - A new version installs beside the old one and waits; the app offers to reload into it
 *   (src/lib/stores/pwa.svelte.ts), so a page is never switched to new files mid-edit.
 */
import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { resolve } from '$app/paths';
import { self as sw } from '$app/service-worker';

const CACHE = `aster-${version}`;
/** The paths in the manifest are relative to the base; the fetch handler sees absolute ones. */
const at = (path: string) => resolve(path as '/');
const SHELL = at('/404.html');
const FILES = [...immutable, ...assets].map((f) => at(f.path));
const ASSETS = [...new Set([...FILES, ...prerendered.map((p) => at(p.path)), SHELL])];
const IMMUTABLE = new Set(FILES);

const notOurs = (path: string) =>
	path === '/docs' || path.startsWith('/docs/') || path.startsWith('/.well-known/');

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(ASSETS.filter((path) => path !== SHELL));
			// The editor shell is served with status 404 (it is the not-found page, preview and
			// Cloudflare alike), which addAll refuses; its body is the page, so keep it as a 200.
			const shell = await fetch(SHELL);
			await cache.put(SHELL, new Response(await shell.blob(), { headers: shell.headers }));
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
			await sw.clients.claim();
		})()
	);
});

// The app's "Reload" (update prompt): the waiting version takes over, then the page reloads.
sw.addEventListener('message', (event) => {
	if (event.data === 'skip-waiting') sw.skipWaiting();
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== sw.location.origin || notOurs(url.pathname)) return;

	if (IMMUTABLE.has(url.pathname)) {
		event.respondWith(caches.match(url.pathname).then((hit) => hit ?? fetch(request)));
		return;
	}
	if (request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					const response = await fetch(request);
					if (response.ok) {
						const cache = await caches.open(CACHE);
						if (ASSETS.includes(url.pathname)) cache.put(url.pathname, response.clone());
					}
					return response;
				} catch {
					return (
						(await caches.match(url.pathname)) ??
						(await caches.match(url.pathname.replace(/\/$/, '') || '/')) ??
						(await caches.match(SHELL)) ??
						Response.error()
					);
				}
			})()
		);
	}
});
