export interface StickerDef {
  id: string;
  label: string;
  group: "标记" | "形状" | "表情";
  glyph: string;
}

export const STICKERS: StickerDef[] = [
  { id: "heart", label: "心", group: "表情", glyph: "♥" },
  { id: "star", label: "星", group: "表情", glyph: "★" },
  { id: "spark", label: "闪", group: "表情", glyph: "✦" },
  { id: "fire", label: "火", group: "表情", glyph: "▲" },
  { id: "note", label: "音符", group: "标记", glyph: "♪" },
  { id: "check", label: "勾", group: "标记", glyph: "✓" },
  { id: "cross", label: "叉", group: "标记", glyph: "✕" },
  { id: "arrow", label: "箭头", group: "形状", glyph: "➤" },
  { id: "circle", label: "圆", group: "形状", glyph: "●" },
  { id: "burst", label: "爆点", group: "形状", glyph: "✸" },
  { id: "badge", label: "章", group: "形状", glyph: "◈" },
  { id: "dot", label: "点", group: "标记", glyph: "●" },
];

export function stickerOf(id: string | undefined): StickerDef | undefined {
  if (!id) return undefined;
  return STICKERS.find((s) => s.id === id);
}

export function drawSticker(ctx: CanvasRenderingContext2D, glyph: string, size: number, color: string) {
  ctx.save();
  ctx.font = `700 ${Math.round(size)}px "Segoe UI Symbol","Noto Sans",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(2, size * 0.06);
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.strokeText(glyph, 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(glyph, 0, 0);
  ctx.restore();
}
