/// <reference lib="webworker" />
/** Parses a `.mdj` off the main thread so a 10 MB file never blocks the UI. */
import { MdjError, parseMdjText, type ParseResult } from './parse.ts';

export type WorkerReply =
	{ ok: true; result: ParseResult } | { ok: false; message: string; invalid: boolean };

self.onmessage = (e: MessageEvent<ArrayBuffer>) => {
	let reply: WorkerReply;
	try {
		// TextDecoder drops a UTF-8 byte-order mark.
		reply = { ok: true, result: parseMdjText(new TextDecoder('utf-8').decode(e.data)) };
	} catch (err) {
		reply = {
			ok: false,
			message: err instanceof Error ? err.message : String(err),
			invalid: err instanceof MdjError
		};
	}
	self.postMessage(reply);
};
