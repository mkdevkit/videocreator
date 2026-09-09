import type { Clip, ClipFx, ColorGrade } from "../types";
import { DEFAULT_FX } from "../types";

export type LookId = "none" | "gray" | "warm" | "cool" | "fade" | "vivid" | "vintage";

export interface StoreFilter {
  id: string;
  label: string;
  group: "调色" | "风格" | "镜头" | "社区";
  grade: ColorGrade;
  vignette: number;
  fx: ClipFx;
}

export const LOOKS: { id: LookId; label: string; grade: ColorGrade; vignette: number }[] = [
  { id: "none", label: "无", grade: { brightness: 1, contrast: 1, saturate: 1 }, vignette: 0 },
  { id: "gray", label: "黑白", grade: { brightness: 1.08, contrast: 1.08, saturate: 0 }, vignette: 0.08 },
  { id: "warm", label: "暖调", grade: { brightness: 1.06, contrast: 1.05, saturate: 1.18 }, vignette: 0.12 },
  { id: "cool", label: "冷调", grade: { brightness: 1.02, contrast: 1.04, saturate: 0.92 }, vignette: 0.1 },
  { id: "fade", label: "褪色", grade: { brightness: 1.1, contrast: 0.82, saturate: 0.78 }, vignette: 0.18 },
  { id: "vivid", label: "鲜艳", grade: { brightness: 1.04, contrast: 1.12, saturate: 1.35 }, vignette: 0.06 },
  { id: "vintage", label: "胶片", grade: { brightness: 1.05, contrast: 0.92, saturate: 0.85 }, vignette: 0.28 },
];

export const STORE_FILTERS: StoreFilter[] = [
  { id: "none", label: "原片", group: "调色", grade: { brightness: 1, contrast: 1, saturate: 1 }, vignette: 0, fx: { ...DEFAULT_FX } },
  { id: "gray", label: "黑白", group: "调色", grade: { brightness: 1.08, contrast: 1.08, saturate: 0 }, vignette: 0.08, fx: { ...DEFAULT_FX } },
  { id: "warm", label: "暖调", group: "调色", grade: { brightness: 1.06, contrast: 1.05, saturate: 1.18 }, vignette: 0.12, fx: { ...DEFAULT_FX } },
  { id: "cool", label: "冷调", group: "调色", grade: { brightness: 1.02, contrast: 1.04, saturate: 0.92 }, vignette: 0.1, fx: { ...DEFAULT_FX } },
  { id: "fade", label: "褪色", group: "调色", grade: { brightness: 1.1, contrast: 0.82, saturate: 0.78 }, vignette: 0.18, fx: { ...DEFAULT_FX } },
  { id: "vivid", label: "鲜艳", group: "调色", grade: { brightness: 1.04, contrast: 1.12, saturate: 1.35 }, vignette: 0.06, fx: { ...DEFAULT_FX } },
  { id: "vintage", label: "胶片", group: "风格", grade: { brightness: 1.05, contrast: 0.92, saturate: 0.85 }, vignette: 0.28, fx: { ...DEFAULT_FX, sepia: 0.25 } },
  { id: "sepia", label: "棕褐", group: "风格", grade: { brightness: 1.04, contrast: 1.05, saturate: 0.7 }, vignette: 0.16, fx: { ...DEFAULT_FX, sepia: 0.7 } },
  { id: "teal", label: "青橙", group: "风格", grade: { brightness: 1.02, contrast: 1.12, saturate: 1.15 }, vignette: 0.14, fx: { ...DEFAULT_FX, hue: -12 } },
  { id: "night", label: "夜景", group: "风格", grade: { brightness: 0.78, contrast: 1.18, saturate: 0.85 }, vignette: 0.32, fx: { ...DEFAULT_FX, hue: 18 } },
  { id: "dream", label: "柔光", group: "镜头", grade: { brightness: 1.12, contrast: 0.9, saturate: 1.08 }, vignette: 0.2, fx: { ...DEFAULT_FX, blur: 1.4 } },
  { id: "sharp", label: "锐化", group: "镜头", grade: { brightness: 1.02, contrast: 1.28, saturate: 1.06 }, vignette: 0.04, fx: { ...DEFAULT_FX } },
  { id: "mono-soft", label: "柔灰", group: "风格", grade: { brightness: 1.1, contrast: 0.88, saturate: 0 }, vignette: 0.22, fx: { ...DEFAULT_FX, grayscale: 1 } },
  { id: "blur", label: "虚化", group: "镜头", grade: { brightness: 1, contrast: 1, saturate: 1 }, vignette: 0.08, fx: { ...DEFAULT_FX, blur: 3.2 } },
];

export const COMMUNITY_PACK: StoreFilter[] = [
  { id: "pack-cinema", label: "影院", group: "社区", grade: { brightness: 0.92, contrast: 1.16, saturate: 0.88 }, vignette: 0.3, fx: { ...DEFAULT_FX, hue: 6 } },
  { id: "pack-clear", label: "清透", group: "社区", grade: { brightness: 1.08, contrast: 1.04, saturate: 1.12 }, vignette: 0.04, fx: { ...DEFAULT_FX } },
  { id: "pack-sunset", label: "暮色", group: "社区", grade: { brightness: 1.04, contrast: 1.1, saturate: 1.22 }, vignette: 0.2, fx: { ...DEFAULT_FX, hue: -18, sepia: 0.18 } },
  { id: "pack-ice", label: "冰蓝", group: "社区", grade: { brightness: 1.02, contrast: 1.14, saturate: 0.86 }, vignette: 0.16, fx: { ...DEFAULT_FX, hue: 22 } },
  { id: "pack-rose", label: "玫瑰", group: "社区", grade: { brightness: 1.06, contrast: 1.02, saturate: 1.2 }, vignette: 0.12, fx: { ...DEFAULT_FX, hue: -8 } },
  { id: "pack-ink", label: "水墨", group: "社区", grade: { brightness: 1.12, contrast: 1.22, saturate: 0.12 }, vignette: 0.24, fx: { ...DEFAULT_FX, grayscale: 0.85 } },
];

export function catalogLooks(custom: StoreFilter[] = []): StoreFilter[] {
  const seen = new Set<string>();
  const out: StoreFilter[] = [];
  for (const look of [...STORE_FILTERS, ...COMMUNITY_PACK, ...custom]) {
    if (seen.has(look.id)) continue;
    seen.add(look.id);
    out.push(look);
  }
  return out;
}

export function cssFilter(g: ColorGrade | undefined, fx?: ClipFx): string {
  const parts: string[] = [];
  if (g && (g.brightness !== 1 || g.contrast !== 1 || g.saturate !== 1)) {
    parts.push(`brightness(${g.brightness})`, `contrast(${g.contrast})`, `saturate(${g.saturate})`);
  }
  if (fx) {
    if (fx.blur > 0.05) parts.push(`blur(${fx.blur}px)`);
    if (Math.abs(fx.hue) > 0.5) parts.push(`hue-rotate(${fx.hue}deg)`);
    if (fx.sepia > 0.02) parts.push(`sepia(${fx.sepia})`);
    if (fx.grayscale > 0.02) parts.push(`grayscale(${fx.grayscale})`);
  }
  return parts.length ? parts.join(" ") : "none";
}

export function lookLabel(id: string | undefined, custom: StoreFilter[] = []): string {
  const store = catalogLooks(custom).find((l) => l.id === id);
  if (store) return store.label;
  const hit = LOOKS.find((l) => l.id === id);
  if (!hit || hit.id === "none") return "调节";
  return hit.label;
}

export function applyLook(id: string, custom: StoreFilter[] = []): Pick<Clip, "look" | "grade" | "vignette" | "fx"> {
  const store = catalogLooks(custom).find((l) => l.id === id);
  if (store) return { look: store.id, grade: { ...store.grade }, vignette: store.vignette, fx: { ...store.fx } };
  const look = LOOKS.find((l) => l.id === id) ?? LOOKS[0];
  return { look: look.id, grade: { ...look.grade }, vignette: look.vignette, fx: { ...DEFAULT_FX } };
}
