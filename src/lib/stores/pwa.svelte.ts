import { flush } from '#lib/persist/autosave.svelte.ts';

/**
 * The update prompt (features.md M3, PWA). A new build's service worker installs beside the
 * running one and waits (src/service-worker.ts); this notices it and offers a reload. Reloading
 * saves the autosave first, then lets the new worker take over, then reloads, so no edit is lost
 * and no page runs on a mix of old and new files.
 */
class Pwa {
	/** A new version is installed and waiting. */
	updateReady = $state(false);
	#waiting: ServiceWorker | null = null;

	async start() {
		if (!('serviceWorker' in navigator)) return;
		const reg = await navigator.serviceWorker.ready;
		const offer = (w: ServiceWorker | null) => {
			// No controller means this is the first install: nothing to update from.
			if (!w || !navigator.serviceWorker.controller) return;
			this.#waiting = w;
			this.updateReady = true;
		};
		offer(reg.waiting);
		reg.addEventListener('updatefound', () => {
			const w = reg.installing;
			w?.addEventListener('statechange', () => {
				if (w.state === 'installed') offer(w);
			});
		});
		// A tab left open for days still hears about a deploy: look again when it comes back.
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') reg.update().catch(() => {});
		});
	}

	async apply() {
		const w = this.#waiting;
		if (!w) return;
		await flush();
		navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {
			once: true
		});
		w.postMessage('skip-waiting');
	}

	dismiss() {
		this.updateReady = false;
	}
}

export const pwa = new Pwa();
