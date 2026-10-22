export { Stack } from './stack.ts';
export { batch } from './batch.ts';
export {
	addClassifier,
	addToDiagram,
	deleteFromDiagram,
	deleteFromModel,
	moveNode,
	setNodePositions,
	restack,
	setViewOrder,
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
	flipRelationship,
	moveWaypoint,
	removeWaypoint,
	replaceElement,
	setEnd,
	setLabelOffset,
	setLineStyle,
	setWaypoints,
	setRelationshipKind,
	setRelationshipName,
	setRelationshipStereotype,
	type ConnectArgs,
	type EndPatch
} from './relationships.ts';
export {
	FLAG_LABEL,
	addDiagram,
	deleteDiagram,
	removeDiagram,
	renameDiagram,
	renameProject,
	restoreDiagram,
	setColour,
	setDiagramDefaults,
	setNodeFlags
} from './display.ts';
export { addNote, addText, linkNote, setElementText, unlinkNote } from './notes.ts';
export { importFragment, removeFragment } from './fragment.ts';
export { addInstance, addLink } from './objects.ts';
