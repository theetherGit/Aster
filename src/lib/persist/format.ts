/**
 * Which codec a file wants. The extension decides, except when the content plainly says otherwise:
 * a StarUML project renamed `.aster` (or an Aster file renamed `.mdj`) still opens as what it is.
 */
export type FileFormat = 'mdj' | 'aster';

export const formatOf = (name: string): FileFormat =>
	/\.aster(\.json)?$/i.test(name) ? 'aster' : 'mdj';

/** The format the bytes are in, from the first few hundred characters; the name breaks ties. */
export function sniffFormat(name: string, head: string): FileFormat {
	const start = head
		.replace(/^\uFEFF/, '')
		.trimStart()
		.slice(0, 400);
	if (/"\$schema"\s*:\s*"https:\/\/asteruml\.app\/schema\//.test(start)) return 'aster';
	if (/"_type"\s*:\s*"Project"/.test(start)) return 'mdj';
	return formatOf(name);
}
