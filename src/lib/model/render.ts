import type { Attribute, DisplayFlags, Operation, Parameter, Visibility } from './types.ts';

const VIS: Record<Visibility, string> = { public: '+', protected: '#', private: '-', package: '~' };

type Flags = Pick<DisplayFlags, 'showVisibility' | 'showType' | 'showOperationSignature'>;
const ALL: Flags = { showVisibility: true, showType: true, showOperationSignature: true };

/** Canonical UML line for an attribute, e.g. `- balance: Money = 0`. */
export function renderAttribute(a: Attribute, flags: Flags = ALL): string {
	if (a.raw !== undefined) return a.raw;
	let s = '';
	if (a.stereotype) s += `«${a.stereotype}» `;
	if (flags.showVisibility) s += `${VIS[a.visibility]} `;
	if (a.isDerived) s += '/';
	s += a.name;
	if (flags.showType && a.type) s += `: ${a.type}`;
	if (a.multiplicity) s += `[${a.multiplicity}]`;
	if (a.defaultValue !== undefined) s += ` = ${a.defaultValue}`;
	if (a.isReadOnly) s += ' {readOnly}';
	return s;
}

export function renderParameter(p: Parameter): string {
	let s = p.direction === 'in' ? '' : `${p.direction} `;
	s += p.name;
	if (p.type) s += `: ${p.type}`;
	if (p.defaultValue !== undefined) s += ` = ${p.defaultValue}`;
	return s;
}

/** Canonical UML line for an operation, e.g. `+ deposit(amount: Money): void`. */
export function renderOperation(o: Operation, flags: Flags = ALL): string {
	if (o.raw !== undefined) return o.raw;
	let s = '';
	if (o.stereotype) s += `«${o.stereotype}» `;
	if (flags.showVisibility) s += `${VIS[o.visibility]} `;
	s += o.name;
	if (flags.showOperationSignature) {
		s += `(${o.parameters.map(renderParameter).join(', ')})`;
		if (o.returnType) s += `: ${o.returnType}`;
	} else {
		s += '()';
	}
	if (o.isQuery) s += ' {query}';
	return s;
}
