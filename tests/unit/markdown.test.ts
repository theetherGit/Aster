import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '#lib/panels/markdown.ts';

describe('documentation preview', () => {
	it('renders the subset and nothing else', () => {
		expect(renderMarkdown('Plain **bold** and *em* with `code`.')).toBe(
			'<p>Plain <strong>bold</strong> and <em>em</em> with <code>code</code>.</p>'
		);
		// Headings sit under the inspector's own h2s: # starts at h3.
		expect(renderMarkdown('# Title\n\n- one\n- two\n\n1. first\n2) second')).toBe(
			'<h3>Title</h3><ul><li>one</li><li>two</li></ul><ol><li>first</li><li>second</li></ol>'
		);
		expect(renderMarkdown('## Two\n### Three')).toBe('<h4>Two</h4><h5>Three</h5>');
		expect(renderMarkdown('See [the spec](https://example.org/x).')).toBe(
			'<p>See <a href="https://example.org/x" rel="noopener" target="_blank">the spec<span class="sr-only"> (opens in a new tab)</span></a>.</p>'
		);
	});
	it('escapes HTML and refuses non-http links', () => {
		expect(renderMarkdown('<img src=x onerror=alert(1)> & co')).toBe(
			'<p>&lt;img src=x onerror=alert(1)&gt; &amp; co</p>'
		);
		expect(renderMarkdown('[x](javascript:alert(1))')).toBe('<p>[x](javascript:alert(1))</p>');
	});
});
