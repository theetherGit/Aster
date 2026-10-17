import { nanoid } from 'nanoid';
import type { Id } from './types.ts';

/** 22-character base64url id, the shape StarUML writes. */
export const newId = (): Id => nanoid(22);
