import { describe, expect, it } from 'vitest';
import { RESERVED, uniqueSlug } from '#lib/persist/slug.ts';

describe('uniqueSlug', () => {
	it('kebab-cases a name and drops the file extension', () => {
		expect(uniqueSlug('Library System', [])).toBe('library-system');
		expect(uniqueSlug('library.mdj', [])).toBe('library');
		expect(uniqueSlug('hospital-v3.aster', [])).toBe('hospital-v3');
		expect(uniqueSlug('notes.aster.json', [])).toBe('notes');
	});

	it('suffixes on collision with the Recent list, skipping nulls', () => {
		expect(uniqueSlug('Library', ['library'])).toBe('library-2');
		expect(uniqueSlug('library.aster', ['library', null, 'library-2', undefined])).toBe(
			'library-3'
		);
		expect(uniqueSlug('Library', ['other'])).toBe('library');
	});

	it('never yields a reserved route word', () => {
		for (const word of RESERVED) expect(uniqueSlug(word, [])).toBe(`${word}-2`);
		expect(uniqueSlug('new', ['new-2'])).toBe('new-3');
	});

	it('falls back when nothing printable is left', () => {
		expect(uniqueSlug('✨', [])).toBe('diagram');
	});
});
