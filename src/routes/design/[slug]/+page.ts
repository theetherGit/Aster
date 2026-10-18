/**
 * `/design/new` and `/design/sample` are prerendered; every other slug is a project in this
 * browser, served through the adapter's fallback page and resolved on the client.
 */
export const prerender = 'auto';
export const entries = () => [{ slug: 'new' }, { slug: 'sample' }];
