// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	/** File System Access API (Chromium); absent elsewhere, hence optional. */
	interface Window {
		showOpenFilePicker?(options?: {
			types?: { description?: string; accept: Record<string, string[]> }[];
			excludeAcceptAllOption?: boolean;
			multiple?: boolean;
		}): Promise<FileSystemFileHandle[]>;
		showSaveFilePicker?(options?: {
			suggestedName?: string;
			types?: { description?: string; accept: Record<string, string[]> }[];
		}): Promise<FileSystemFileHandle>;
	}
}

export {};
