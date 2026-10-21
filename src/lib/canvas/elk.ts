/** ELK in a Web Worker (M3.3 prompt), made on first use so the app never loads it otherwise. */
import ELK from 'elkjs/lib/elk-api.js';
import workerUrl from 'elkjs/lib/elk-worker.min.js?url';

let elk: InstanceType<typeof ELK> | undefined;
export const workerElk = () => (elk ??= new ELK({ workerUrl }));
