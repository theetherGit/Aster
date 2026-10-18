export { Stack } from './stack.ts';
export { batch } from './batch.ts';
export {
	addClassifier,
	addToDiagram,
	deleteFromDiagram,
	deleteFromModel,
	moveNode,
	setNodePositions,
	setDocumentation,
	renameClassifier,
	resizeNode,
	restoreElements,
	setClassifierFlags,
	MOVE_COALESCE_MS,
	type ClassifierFlags
} from './elements.ts';
export {
	addMember,
	deleteMember,
	replaceMember,
	setMemberText,
	reorderMember,
	setClassifierKind,
	setLiterals,
	membersOf,
	type Member,
	type MemberKind
} from './members.ts';
export {
	addWaypoint,
	connect,
	moveWaypoint,
	removeWaypoint,
	replaceElement,
	setEnd,
	setLabelOffset,
	setLineStyle,
	setRelationshipKind,
	setRelationshipName,
	setRelationshipStereotype,
	type ConnectArgs,
	type EndPatch
} from './relationships.ts';
export { FLAG_LABEL, renameDiagram, setDiagramDefaults, setNodeFlags } from './display.ts';
export { addNote, addText, linkNote, setElementText, unlinkNote } from './notes.ts';
