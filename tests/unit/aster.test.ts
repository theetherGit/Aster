/** `.aster` round trip (docs/file-format.md): parseAster(serializeAster(p)) is structurally p. */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	ASTER_SCHEMA,
	AsterError,
	hashBytes,
	lossReport,
	migrate,
	parseAster,
	serializeAster,
	serializeAsterText
} from '#lib/aster/index.ts';
import { Stack, addMember, connect, renameClassifier } from '#lib/commands/index.ts';
import { memberFromText } from '#lib/mdj/expression.ts';
import { parseMdjText } from '#lib/mdj/parse.ts';
import { notationProject, sampleProject } from '#lib/model/fixtures.ts';
import { newId } from '#lib/model/ids.ts';

const dir = new URL('../../fixtures/mdj/', import.meta.url);
const files = readdirSync(dir)
	.filter((f) => f.endsWith('.mdj'))
	.sort();

describe('.aster round trip', () => {
	it.each(files)('%s: parse → serializeAster → parseAster equals the project', (file) => {
		const { project } = parseMdjText(readFileSync(new URL(file, dir), 'utf8'));
		const back = parseAster(serializeAster(project)).project;
		expect(back).toEqual(project);
		expect(back.elements).toBeInstanceOf(Map);
		expect(back.importedIds).toBeInstanceOf(Set);
		expect([...back.elements.keys()]).toEqual([...project.elements.keys()]); // insertion order kept
	});

	it('an Aster-born project with edits, through text, with origin', async () => {
		const project = notationProject();
		const stack = new Stack(() => project);
		stack.run(renameClassifier(project, { id: 'Loan', name: 'Lending' }));
		stack.run(
			addMember(project, {
				classifierId: 'Book',
				kind: 'attribute',
				member: memberFromText('attribute', '- pages: int = 0', newId())
			})
		);
		stack.run(
			connect(project, {
				diagramId: project.diagrams[0].id,
				id: 'x1',
				sourceId: 'Book',
				targetId: 'Person',
				kind: 'dependency'
			})
		);
		const origin = {
			kind: 'staruml' as const,
			sourceHash: await hashBytes('abc'),
			fileName: 'x.mdj'
		};
		const text = serializeAsterText(project, origin);
		const json = JSON.parse(text);
		expect(json.$schema).toBe(ASTER_SCHEMA);
		expect(json.version).toBe(1);
		expect(json.meta.app).toBe('Aster');
		const { project: back, origin: o } = parseAster(text);
		expect(back).toEqual(project);
		expect(o).toEqual(origin);
		expect(origin.sourceHash).toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
		);
	});

	it('is strict: unknown fields, wrong types and other versions fail with a JSON path', () => {
		const doc = serializeAster(sampleProject());
		const withExtra = structuredClone(doc) as unknown as Record<string, unknown>;
		(withExtra.project as Record<string, unknown>).colour = 'red';
		expect(() => parseAster(withExtra)).toThrow(AsterError);
		expect(() => parseAster(withExtra)).toThrow('$.project.colour: unknown field');

		const badType = structuredClone(doc);
		const account = badType.project.elements.Account as unknown as Record<string, unknown>;
		account.isAbstract = 'yes';
		expect(() => parseAster(badType)).toThrow(
			'$.project.elements.Account.isAbstract: expected true or false, got "yes"'
		);

		const newer = { ...structuredClone(doc), version: 2 };
		expect(() => parseAster(newer)).toThrow('$.version: written by a newer Aster');
		expect(() => migrate({ version: 0 })).toThrow('$.version: expected version 1');
		expect(() => parseAster('not json')).toThrow('$: not valid JSON');
		expect(() => parseAster({ version: 1, project: 1 })).toThrow('$.project: expected an object');
	});

	it('lossReport is empty in v1 by construction', () => {
		expect(lossReport(notationProject())).toEqual([]);
	});
});
