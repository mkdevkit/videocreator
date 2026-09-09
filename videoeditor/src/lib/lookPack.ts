import type { CustomLook } from "../types";
import { DEFAULT_FX, DEFAULT_GRADE } from "../types";
import { uid } from "./ids";

const PACK_KEY = "videoeditor.lookPacks";

export function loadLocalLooks(): CustomLook[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PACK_KEY) || "[]") as CustomLook[];
    return Array.isArray(raw) ? raw.map(normalizeLook) : [];
  } catch {
    return [];
  }
}

export function saveLocalLooks(looks: CustomLook[]) {
  try {
    localStorage.setItem(PACK_KEY, JSON.stringify(looks.map(normalizeLook)));
  } catch {
    /* quota */
  }
}

export function normalizeLook(raw: Partial<CustomLook>): CustomLook {
  return {
    id: raw.id || uid("lk"),
    label: raw.label || "未命名",
    group: raw.group === "调色" || raw.group === "风格" || raw.group === "镜头" ? raw.group : "社区",
    grade: { ...DEFAULT_GRADE, ...raw.grade },
    vignette: typeof raw.vignette === "number" ? raw.vignette : 0,
    fx: { ...DEFAULT_FX, ...raw.fx },
  };
}

export function parseLookPack(text: string): CustomLook[] {
  const data = JSON.parse(text) as { looks?: Partial<CustomLook>[]; kind?: string } | Partial<CustomLook>[];
  const rows = Array.isArray(data) ? data : data.looks;
  if (!Array.isArray(rows)) throw new Error("不是滤镜包");
  return rows.map(normalizeLook);
}

export function serializeLookPack(looks: CustomLook[]): string {
  return `${JSON.stringify({ kind: "videoeditor-filter-pack", version: 1, looks }, null, 2)}\n`;
}

export function mergeLooks(base: CustomLook[], incoming: CustomLook[]): CustomLook[] {
  const map = new Map(base.map((l) => [l.id, l]));
  for (const look of incoming) {
    const id = map.has(look.id) ? uid("lk") : look.id;
    map.set(id, { ...look, id });
  }
  return [...map.values()];
}
