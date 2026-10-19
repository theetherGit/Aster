import { describe, expect, it } from 'vitest';
import { formatOf, sniffFormat } from '#lib/persist/format.ts';

describe('file format by content', () => {
	const staruml = '{"_type":"Project","_id":"AAAA","name":"Untitled","ownedElements":[]}';
	const aster = '{\n\t"$schema": "https://asteruml.app/schema/v1.json",\n\t"version": 1,';
	it('reads the extension when the content is unknown', () => {
		expect(formatOf('x.mdj')).toBe('mdj');
		expect(formatOf('x.aster')).toBe('aster');
		expect(formatOf('x.aster.json')).toBe('aster');
		expect(sniffFormat('x.aster', '{"something":1}')).toBe('aster');
	});
	it('lets the content overrule a wrong extension', () => {
		expect(sniffFormat('renamed.aster', staruml)).toBe('mdj');
		expect(sniffFormat('renamed.mdj', aster)).toBe('aster');
		expect(sniffFormat('bom.aster', '\uFEFF' + staruml)).toBe('mdj');
	});
});

describe('suggested file name', () => {
	it('keeps the open file name for its own format and swaps the extension for the other', async () => {
		const { files, suggestedName } = await import('#lib/persist/files.svelte.ts');
		files.current = { name: 'public-ziapi.mdj', format: 'mdj' } as never;
		expect(suggestedName('mdj')).toBe('public-ziapi.mdj');
		expect(suggestedName('aster')).toBe('public-ziapi.aster');
		files.current = { name: 'library.aster.json', format: 'aster' } as never;
		expect(suggestedName('mdj')).toBe('library.mdj');
		files.current = null;
	});
});
