import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '#lib/panels/markdown.ts';

describe('documentation preview', () => {
	it('renders the subset and nothing else', () => {
		expect(renderMarkdown('Plain **bold** and *em* with `code`.')).toBe(
			'<p>Plain <strong>bold</strong> and <em>em</em> with <code>code</code>.</p>'
		);
		expect(renderMarkdown('# Title\n\n- one\n- two\n\n1. first\n2) second')).toBe(
			'<h1>Title</h1><ul><li>one</li><li>two</li></ul><ol><li>first</li><li>second</li></ol>'
		);
		expect(renderMarkdown('See [the spec](https://example.org/x).')).toBe(
			'<p>See <a href="https://example.org/x" rel="noopener" target="_blank">the spec</a>.</p>'
		);
	});
	it('escapes HTML and refuses non-http links', () => {
		expect(renderMarkdown('<img src=x onerror=alert(1)> & co')).toBe(
			'<p>&lt;img src=x onerror=alert(1)&gt; &amp; co</p>'
		);
		expect(renderMarkdown('[x](javascript:alert(1))')).toBe('<p>[x](javascript:alert(1))</p>');
	});
});
