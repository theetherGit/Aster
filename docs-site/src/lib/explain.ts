/**
 * The member line playground's brain: Aster's own parser (src/lib/mdj/expression.ts) and the chip's
 * own words (src/lib/i18n/en.json), so the docs explain a line exactly as the app's chip does. It
 * mirrors `summarise` in src/lib/canvas/summary.ts, which cannot load here (its i18n module uses
 * Svelte runes); the root's tests/unit/docs-explain.test.ts fails if the two ever disagree.
 */
import en from "../../../src/lib/i18n/en.json";
import { isRaw, parseMember, renderMember, type MemberKind } from "../../../src/lib/mdj/expression.ts";

type Key = keyof typeof en;
const t = (key: Key, params: Record<string, string | number> = {}) =>
  Object.entries(params).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), en[key] as string);

const CLOSER = { paren: ")", bracket: "]", brace: "}", guillemet: ">>" } as const;

export interface Explained {
  /** Read into the model (green chip), or kept as text (amber chip). */
  ok: boolean;
  /** The chip's segments, as the app shows them under the class. */
  parts: string[];
  /** The line as Aster writes it back. */
  reads?: string;
  /** The line with the missing closer added, when that makes it readable, and the chip's words for it. */
  fix?: { text: string; label: string };
  /** Each part Aster found, in reading order. */
  fields: [label: string, value: string][];
}

export function explain(kind: MemberKind, text: string): Explained {
  const p = parseMember(kind, text);
  if (isRaw(p)) {
    const r = p.reason;
    const reason =
      r?.code === "paren" || r?.code === "bracket" || r?.code === "brace" || r?.code === "guillemet"
        ? t("member.reason.missing", { closer: CLOSER[r.code] })
        : r?.code === "property"
          ? t("member.reason.property", { name: `{${r.detail}}` })
          : r?.code === "parameter"
            ? t("member.reason.parameter", { text: r.detail ?? "" })
            : t("member.reason.syntax");
    // As the chip's suggestion (summary.ts suggestFor): the closer is what the fix adds.
    const fix = r?.fix
      ? { text: r.fix, label: t("member.suggest.fix", { closer: r.fix.slice(text.trimEnd().length) }) }
      : undefined;
    return { ok: false, parts: [t("member.summary.raw"), reason], fix, fields: [] };
  }

  const fields: [string, string][] = [["Name", p.name]];
  if (p.stereotype) fields.push(["Stereotype", `«${p.stereotype}»`]);
  if (kind === "literal")
    return { ok: true, parts: [t("member.summary.literal")], reads: renderMember(kind, p), fields };

  const parts: string[] = [];
  if ("visibility" in p) {
    parts.push(t(`vis.${p.visibility}` as Key));
    fields.splice(1, 0, ["Visibility", p.visibility]);
  }
  if ("parameters" in p) {
    if (p.returnType) parts.push(t("member.summary.returns", { type: p.returnType }));
    if (p.parameters.length)
      parts.push(
        t(p.parameters.length === 1 ? "member.summary.params.one" : "member.summary.params", {
          count: p.parameters.length,
        }),
      );
    fields.push([
      "Parameters",
      p.parameters.length
        ? p.parameters
            .map(
              (q) =>
                `${q.direction === "in" ? "" : `${q.direction} `}${q.name}${q.type ? `: ${q.type}` : ""}${q.defaultValue !== undefined ? ` = ${q.defaultValue}` : ""}`,
            )
            .join(", ")
        : "none",
    ]);
    if (p.returnType) fields.push(["Returns", p.returnType]);
  } else if ("type" in p) {
    if (p.type) parts.push(p.type);
    if (p.defaultValue !== undefined) parts.push(t("member.summary.default", { value: p.defaultValue }));
    if (p.type) fields.push(["Type", p.type]);
    if (p.multiplicity) fields.push(["Multiplicity", p.multiplicity]);
    if (p.defaultValue !== undefined) fields.push(["Default", p.defaultValue]);
  }

  const flags: string[] = [];
  if ("isStatic" in p && p.isStatic) flags.push(t("member.flag.static"));
  if ("isAbstract" in p && p.isAbstract) flags.push(t("member.flag.abstract"));
  if ("isDerived" in p && p.isDerived) flags.push(t("member.flag.derived"));
  if ("isReadOnly" in p && p.isReadOnly) flags.push(t("member.flag.readOnly"));
  if ("isQuery" in p && p.isQuery) flags.push(t("member.flag.query"));
  parts.push(...flags);
  const more = [
    "isOrdered" in p && p.isOrdered && "ordered",
    "isUnique" in p && p.isUnique && "unique",
    "isID" in p && p.isID && "id",
  ].filter(Boolean) as string[];
  if (flags.length || more.length) fields.push(["Properties", [...flags, ...more].join(", ")]);

  return { ok: true, parts, reads: renderMember(kind, p), fields };
}
