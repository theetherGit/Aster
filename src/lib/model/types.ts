// Authored by hand; do not modify without asking.
// This file is the contract for the whole app. Every other module derives from it.
// No Svelte, no Svelte Flow, no DOM types in here.

export type Id = string;

export type Visibility = 'public' | 'protected' | 'private' | 'package';

export type ClassifierKind = 'class' | 'interface' | 'enum' | 'dataType';

export type RelationshipKind =
  | 'association'
  | 'aggregation'
  | 'composition'
  | 'generalization'
  | 'realization'
  | 'dependency';

export type Navigability = 'unspecified' | 'navigable' | 'notNavigable';

export type LineStyle = 'rectilinear' | 'oblique' | 'roundrect' | 'curve';

export type StereotypeDisplay =
  | 'none'
  | 'label'
  | 'decoration'
  | 'decoration-label'
  | 'icon'
  | 'icon-label';

export type DiagramKind = 'class' | 'object';

// ---------------------------------------------------------------------------
// Model elements
// ---------------------------------------------------------------------------

export interface Parameter {
  name: string;
  type?: string;
  direction: 'in' | 'out' | 'inout';
  defaultValue?: string;
}

export interface Attribute {
  id: Id;
  name: string;
  type?: string;
  visibility: Visibility;
  multiplicity?: string;
  defaultValue?: string;
  isStatic: boolean;
  isReadOnly: boolean;
  isDerived: boolean;
  stereotype?: string;
  documentation: string;
  /** Set only when the source line could not be parsed; rendered verbatim. */
  raw?: string;
}

export interface Operation {
  id: Id;
  name: string;
  visibility: Visibility;
  returnType?: string;
  parameters: Parameter[];
  isStatic: boolean;
  isAbstract: boolean;
  isQuery: boolean;
  stereotype?: string;
  documentation: string;
  raw?: string;
}

export interface Literal {
  id: Id;
  name: string;
  stereotype?: string;
  documentation: string;
}

export interface Classifier {
  kind: 'classifier';
  id: Id;
  classifierKind: ClassifierKind;
  name: string;
  stereotype?: string;
  isAbstract: boolean;
  isLeaf: boolean;
  visibility: Visibility;
  documentation: string;
  attributes: Attribute[];
  operations: Operation[];
  /** Enumerations only. */
  literals: Literal[];
  packageId?: Id;
}

export interface End {
  role?: string;
  multiplicity?: string;
  navigable: Navigability;
  visibility?: Visibility;
  isDerived: boolean;
  /** True when this end's class owns the other end's attribute (draws the ownership dot). */
  ownsOther: boolean;
}

export interface Relationship {
  kind: 'relationship';
  id: Id;
  relationshipKind: RelationshipKind;
  /** For aggregation and composition, the diamond is drawn at the target (the whole). */
  sourceId: Id;
  targetId: Id;
  name?: string;
  stereotype?: string;
  documentation: string;
  /** Present only for association, aggregation and composition. */
  sourceEnd?: End;
  targetEnd?: End;
}

export interface Package {
  kind: 'package';
  id: Id;
  name: string;
  memberIds: Id[];
  parentId?: Id;
  documentation: string;
}

export interface Note {
  kind: 'note';
  id: Id;
  text: string;
  /** Elements this note is linked to (view-only edges). */
  linkedIds: Id[];
}

export interface TextElement {
  kind: 'text';
  id: Id;
  text: string;
}

export type Element = Classifier | Relationship | Package | Note | TextElement;

// ---------------------------------------------------------------------------
// Layout (per diagram; pixels in StarUML's coordinate space)
// ---------------------------------------------------------------------------

export interface Point {
  x: number;
  y: number;
}

export interface DisplayFlags {
  showVisibility: boolean;
  showType: boolean;
  showMultiplicity: boolean;
  showOperationSignature: boolean;
  showNamespace: boolean;
  showProperty: boolean;
  suppressAttributes: boolean;
  suppressOperations: boolean;
  suppressLiterals: boolean;
  stereotypeDisplay: StereotypeDisplay;
  wordWrap: boolean;
  autoResize: boolean;
}

export interface NodeLayout {
  kind: 'node';
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  line?: string;
  flags?: Partial<DisplayFlags>;
}

export type LabelKey =
  | 'name'
  | 'sourceMultiplicity'
  | 'targetMultiplicity'
  | 'sourceRole'
  | 'targetRole'
  | 'sourceProperty'
  | 'targetProperty';

export interface LabelOffset {
  /** Angle from the edge direction, radians, as StarUML stores it. */
  alpha: number;
  /** Distance from the edge midpoint/end, pixels. */
  distance: number;
}

export interface EdgeLayout {
  kind: 'edge';
  /** Interior waypoints only; endpoints are recomputed from node borders. */
  waypoints: Point[];
  lineStyle: LineStyle;
  line?: string;
  labelOffsets: Partial<Record<LabelKey, LabelOffset>>;
}

export type Layout = NodeLayout | EdgeLayout;

export interface Diagram {
  id: Id;
  name: string;
  diagramKind: DiagramKind;
  /** Elements that have a view on this diagram, in z-order (back to front). */
  elementIds: Id[];
  layout: Map<Id, Layout>;
  defaults: DisplayFlags;
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

/** Anything in a .mdj that Aster does not model. Written back verbatim. */
export interface Unknown {
  json: unknown;
  /** _id of the element whose array held this, or null for root-level. */
  parentId: Id | null;
  /** Array name on the parent, e.g. "ownedElements", "ownedViews". */
  path: string;
  /** Index among siblings at parse time, for stable re-insertion. */
  index: number;
}

export interface Project {
  id: Id;
  name: string;
  diagrams: Diagram[];
  elements: Map<Id, Element>;
  unknown: Unknown[];
  /** Ids that came from an imported .mdj and must be preserved on export. */
  importedIds: Set<Id>;
}

export const DEFAULT_DISPLAY_FLAGS: DisplayFlags = {
  showVisibility: true,
  showType: true,
  showMultiplicity: true,
  showOperationSignature: true,
  showNamespace: false,
  showProperty: false,
  suppressAttributes: false,
  suppressOperations: false,
  suppressLiterals: false,
  stereotypeDisplay: 'label',
  wordWrap: false,
  autoResize: true,
};
