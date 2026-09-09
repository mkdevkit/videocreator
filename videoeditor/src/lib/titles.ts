import { DEFAULT_TEXT_STYLE, type TextStyle } from "../types";

export interface TitlePreset {
  id: string;
  label: string;
  group: "字幕" | "花字" | "标题";
  style: TextStyle;
}

export const TITLE_PRESETS: TitlePreset[] = [
  { id: "plain", label: "素字", group: "字幕", style: { ...DEFAULT_TEXT_STYLE } },
  { id: "caption", label: "描边字幕", group: "字幕", style: { ...DEFAULT_TEXT_STYLE, strokeWidth: 0.22, weight: 700 } },
  { id: "soft", label: "柔影", group: "字幕", style: { ...DEFAULT_TEXT_STYLE, shadow: 0.35, shadowColor: "#000000", strokeWidth: 0.06 } },
  { id: "pop", label: "撞色", group: "花字", style: { ...DEFAULT_TEXT_STYLE, color: "#ff4d6d", stroke: "#fff4d6", strokeWidth: 0.28, weight: 700, shadow: 0.2 } },
  { id: "gold", label: "金字", group: "花字", style: { ...DEFAULT_TEXT_STYLE, color: "#f0c36a", stroke: "#3a2208", strokeWidth: 0.2, weight: 700, shadow: 0.25, shadowColor: "#7a4a10" } },
  { id: "neon", label: "霓虹", group: "花字", style: { ...DEFAULT_TEXT_STYLE, color: "#7ef0ff", stroke: "#123047", strokeWidth: 0.16, shadow: 0.45, shadowColor: "#2ad4ff", italic: true } },
  { id: "poster", label: "海报", group: "标题", style: { ...DEFAULT_TEXT_STYLE, fontId: "noto-serif", fontSize: 6.2, color: "#f3eee3", stroke: "#1a1208", strokeWidth: 0.18, weight: 700 } },
  { id: "italic", label: "斜体旁白", group: "标题", style: { ...DEFAULT_TEXT_STYLE, fontId: "noto-serif", italic: true, color: "#efe6d4", strokeWidth: 0.08, shadow: 0.2 } },
];

export function titlePreset(id: string): TitlePreset {
  return TITLE_PRESETS.find((t) => t.id === id) ?? TITLE_PRESETS[0];
}
