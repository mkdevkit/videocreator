import type { ChromaKey } from "../types";

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const v = Number.parseInt(n.slice(0, 6), 16);
  if (!Number.isFinite(v)) return [0, 255, 0];
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

const scratch = document.createElement("canvas");
const sctx = scratch.getContext("2d", { willReadFrequently: true });

export function chromaSource(source: CanvasImageSource, chroma: ChromaKey | undefined, dw: number, dh: number): CanvasImageSource {
  if (!chroma?.enabled || !sctx) return source;
  const w = Math.max(2, Math.round(dw));
  const h = Math.max(2, Math.round(dh));
  if (scratch.width !== w || scratch.height !== h) {
    scratch.width = w;
    scratch.height = h;
  }
  sctx.clearRect(0, 0, w, h);
  sctx.drawImage(source, 0, 0, w, h);
  const img = sctx.getImageData(0, 0, w, h);
  const [tr, tg, tb] = hexRgb(chroma.color);
  const sim = Math.min(1, Math.max(0, chroma.similarity));
  const smooth = Math.min(1, Math.max(0.001, chroma.smoothness));
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const dist = Math.hypot(r - tr, g - tg, b - tb) / 441.67;
    let a = 1;
    if (dist <= sim) a = 0;
    else if (dist < sim + smooth) a = (dist - sim) / smooth;
    data[i + 3] = Math.round((data[i + 3] ?? 0) * a);
    if (a < 0.95 && tg >= tr && tg >= tb) {
      const spill = Math.max(0, g - Math.max(r, b));
      data[i + 1] = Math.max(0, g - spill * (1 - a));
    }
  }
  sctx.putImageData(img, 0, 0);
  return scratch;
}
