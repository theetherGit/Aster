import { MdjError, type ParseResult } from './parse.ts';
import type { WorkerReply } from './parse.worker.ts';

/** Parse `.mdj` bytes in a Web Worker. The buffer is transferred, so the caller loses it. */
export function parseInWorker(data: ArrayBuffer): Promise<ParseResult> {
	return new Promise((resolve, reject) => {
		const worker = new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' });
		worker.onmessage = (e: MessageEvent<WorkerReply>) => {
			worker.terminate();
			if (e.data.ok) resolve(e.data.result);
			else reject(e.data.invalid ? new MdjError(e.data.message) : new Error(e.data.message));
		};
		worker.onerror = (e) => {
			worker.terminate();
			reject(new Error(e.message));
		};
		worker.postMessage(data, [data]);
	});
}
