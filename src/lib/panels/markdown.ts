/**
 * The documentation field's preview: a small, safe Markdown subset rendered to HTML. Text is
 * escaped first; only our own tags come out. Paragraphs, headings, bullet and numbered lists,
 * `code`, **bold**, *italic* and [links](http…) are enough for a class's documentation.
 */
const esc = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s: string): string {
	return esc(s)
		.replace(/`([^`]+)`/g, '<code>$1</code>')
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
		.replace(
			/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
			'<a href="$2" rel="noopener" target="_blank">$1</a>'
		);
}

export function renderMarkdown(text: string): string {
	const out: string[] = [];
	let list: 'ul' | 'ol' | null = null;
	let para: string[] = [];
	const flushPara = () => {
		if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`);
		para = [];
	};
	const closeList = () => {
		if (list) out.push(`</${list}>`);
		list = null;
	};
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trimEnd();
		const heading = /^(#{1,3})\s+(.*)$/.exec(line);
		const bullet = /^[-*]\s+(.*)$/.exec(line);
		const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
		if (!line.trim()) {
			flushPara();
			closeList();
		} else if (heading) {
			flushPara();
			closeList();
			out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
		} else if (bullet || numbered) {
			flushPara();
			const kind = bullet ? 'ul' : 'ol';
			if (list !== kind) {
				closeList();
				list = kind;
				out.push(`<${kind}>`);
			}
			out.push(`<li>${inline((bullet ?? numbered)![1])}</li>`);
		} else {
			closeList();
			para.push(line);
		}
	}
	flushPara();
	closeList();
	return out.join('');
}
