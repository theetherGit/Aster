import type { Finding } from '#lib/model/validate.ts';

/**
 * The validation panel's state (features.md M2). Findings are recomputed by the editor route a
 * moment after the model settles (a drag is many commands); they never block anything.
 */
class Validation {
	findings: Finding[] = $state([]);
	open = $state(false);
}
export const validation = new Validation();
