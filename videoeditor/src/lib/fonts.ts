import type { StageFontId } from "../types";

export const STAGE_FONTS: { id: StageFontId; label: string; css: string }[] = [
  { id: "noto-sans", label: "Noto Sans", css: '"Noto Sans SC", "Noto Sans", sans-serif' },
  { id: "noto-serif", label: "Noto Serif", css: '"Noto Serif SC", "Noto Serif", serif' },
];

export function fontCss(id: StageFontId | undefined): string {
  return STAGE_FONTS.find((f) => f.id === id)?.css ?? STAGE_FONTS[0].css;
}

export async function waitStageFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  const samples = [
    '16px "Noto Sans"',
    '700 16px "Noto Sans"',
    '16px "Noto Sans SC"',
    '700 16px "Noto Sans SC"',
    '16px "Noto Serif"',
    '16px "Noto Serif SC"',
    '700 16px "Noto Serif SC"',
  ];
  try {
    await Promise.race([
      Promise.all([document.fonts.ready, ...samples.map((s) => document.fonts.load(s))]),
      new Promise<void>((r) => window.setTimeout(r, 8000)),
    ]);
  } catch {
    /* bundled faces; timeout is fine */
  }
}
