/**
 * The JSON Schema every .aster file names in `$schema` (https://asteruml.app/schema/v1.json) is
 * written out of the validator itself (`asterJsonSchema`), kept in static/schema/v1.json by a file
 * snapshot (`pnpm test -u` rewrites it; CI fails on drift). Every .aster Aster writes from the
 * fixture corpus and the templates conforms to it, and broken files do not.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { serializeAster } from '#lib/aster/index.ts';
import { asterJsonSchema, type JsonSchema } from '#lib/aster/schema.ts';
import { parseMdjText } from '#lib/mdj/parse.ts';
import { demoProject } from '#lib/model/demo.ts';
import { notationProject, sampleProject } from '#lib/model/fixtures.ts';
import { templateProject, type TemplateSpec } from '#lib/templates/index.ts';

const schema = asterJsonSchema();

/** A checker for exactly the keywords the schema uses; it says where and why a value fails. */
function check(value: unknown, s: JsonSchema, path = '$'): string | null {
	if (s.$ref) {
		const name = String(s.$ref).replace('#/$defs/', '');
		return check(value, (schema.$defs as Record<string, JsonSchema>)[name], path);
	}
	if ('const' in s && value !== s.const) return `${path}: not ${JSON.stringify(s.const)}`;
	if (s.enum && !(s.enum as unknown[]).includes(value)) return `${path}: not in enum`;
	if (s.oneOf) {
		const passing = (s.oneOf as JsonSchema[]).filter((o) => check(value, o, path) === null);
		return passing.length === 1 ? null : `${path}: ${passing.length} of oneOf match`;
	}
	const types = s.type === undefined ? null : ([] as unknown[]).concat(s.type);
	const kind = Array.isArray(value)
		? 'array'
		: value === null
			? 'null'
			: typeof value === 'number'
				? 'number'
				: typeof value;
	if (types && !types.includes(kind)) return `${path}: ${kind}, not ${types.join(' or ')}`;
	if (kind === 'array' && s.items)
		for (const [i, x] of (value as unknown[]).entries()) {
			const e = check(x, s.items as JsonSchema, `${path}[${i}]`);
			if (e) return e;
		}
	if (kind === 'object') {
		const obj = value as Record<string, unknown>;
		const props = (s.properties ?? {}) as Record<string, JsonSchema>;
		for (const r of (s.required ?? []) as string[]) if (!(r in obj)) return `${path}: missing ${r}`;
		for (const [k, x] of Object.entries(obj)) {
			const sub =
				props[k] ??
				(s.additionalProperties === false ? null : (s.additionalProperties as JsonSchema));
			if (sub === null) return `${path}.${k}: not allowed`;
			if (sub) {
				const e = check(x, sub, `${path}.${k}`);
				if (e) return e;
			}
		}
	}
	return null;
}

describe('the .aster JSON Schema', () => {
	it('is published as static/schema/v1.json, written from the validator', async () => {
		expect(schema.$id).toBe('https://asteruml.app/schema/v1.json');
		await expect(JSON.stringify(schema, null, '\t') + '\n').toMatchFileSnapshot(
			'../../static/schema/v1.json'
		);
	});

	const fixtures = new URL('../../fixtures/mdj/', import.meta.url);
	const templates = new URL('../../src/lib/templates/specs/', import.meta.url);
	const projects = [
		...readdirSync(fixtures)
			.filter((f) => f.endsWith('.mdj'))
			.map((f) => [f, parseMdjText(readFileSync(new URL(f, fixtures), 'utf8')).project] as const),
		...readdirSync(templates).map(
			(f) =>
				[
					`template ${f}`,
					templateProject(JSON.parse(readFileSync(new URL(f, templates), 'utf8')) as TemplateSpec)
				] as const
		),
		['sample', sampleProject()] as const,
		['notation', notationProject()] as const,
		['demo', demoProject()] as const
	];
	it.each(projects)('%s: what Aster writes conforms', (_name, project) => {
		const file = JSON.parse(JSON.stringify(serializeAster(project)));
		expect(check(file, schema)).toBeNull();
	});

	it('rejects what the validator rejects', () => {
		type Doc = {
			version: unknown;
			project: Record<string, unknown> & {
				elements: Record<string, Record<string, unknown>>;
				diagrams: { defaults?: unknown; layout: Record<string, Record<string, unknown>> }[];
			};
		};
		const good = JSON.parse(JSON.stringify(serializeAster(sampleProject()))) as Doc;
		const broken = (edit: (f: Doc) => void) => {
			const f = structuredClone(good);
			edit(f);
			return check(f, schema);
		};
		expect(broken((f) => (f.version = 2))).toMatch(/version/);
		expect(broken((f) => (f.project.surprise = true))).toMatch(/surprise: not allowed/);
		expect(broken((f) => delete f.project.diagrams[0].defaults)).toMatch(/missing defaults/);
		expect(broken((f) => (Object.values(f.project.elements)[0].kind = 'gizmo'))).toMatch(/oneOf/);
		expect(broken((f) => (f.project.diagrams[0].layout.Account.x = 'left'))).not.toBeNull();
	});
});
