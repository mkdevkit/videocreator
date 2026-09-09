import type { Clip, StabSeries } from "../types";
import { probeVideo } from "./media";

const scratch = typeof document !== "undefined" ? document.createElement("canvas") : null;

function lumaAt(data: Uint8ClampedArray, w: number, x: number, y: number, tw: number, th: number): number {
  let s = 0;
  let n = 0;
  for (let yy = y; yy < y + th; yy++) {
    for (let xx = x; xx < x + tw; xx++) {
      const i = (yy * w + xx) * 4;
      s += 0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0);
      n++;
    }
  }
  return n ? s / n : 0;
}

function matchShift(prev: Uint8ClampedArray, cur: Uint8ClampedArray, w: number, h: number): { dx: number; dy: number } {
  const bw = 10;
  const bh = 8;
  const cx = Math.floor(w / 2 - bw / 2);
  const cy = Math.floor(h / 2 - bh / 2);
  const ref = lumaAt(prev, w, cx, cy, bw, bh);
  let best = 1e9;
  let dx = 0;
  let dy = 0;
  for (let oy = -4; oy <= 4; oy++) {
    for (let ox = -5; ox <= 5; ox++) {
      const v = lumaAt(cur, w, cx + ox, cy + oy, bw, bh);
      const d = Math.abs(v - ref);
      if (d < best) {
        best = d;
        dx = ox;
        dy = oy;
      }
    }
  }
  return { dx: dx / w, dy: dy / h };
}

export async function analyzeStabilize(mediaId: string, durationMs: number, onProgress?: (r: number) => void): Promise<StabSeries> {
  const fps = 12;
  const w = 96;
  const h = 54;
  const frames = Math.max(2, Math.ceil((durationMs / 1000) * fps));
  const rawX: number[] = [];
  const rawY: number[] = [];
  if (!scratch) return { fps, dx: [0], dy: [0] };
  scratch.width = w;
  scratch.height = h;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { fps, dx: [0], dy: [0] };
  let prev: Uint8ClampedArray | null = null;
  let accX = 0;
  let accY = 0;
  for (let i = 0; i < frames; i++) {
    const video = await probeVideo(mediaId, i / fps);
    if (!video) {
      rawX.push(accX);
      rawY.push(accY);
      continue;
    }
    ctx.drawImage(video, 0, 0, w, h);
    const cur = ctx.getImageData(0, 0, w, h).data;
    if (prev) {
      const s = matchShift(prev, cur, w, h);
      accX += s.dx;
      accY += s.dy;
    }
    rawX.push(accX);
    rawY.push(accY);
    prev = new Uint8ClampedArray(cur);
    onProgress?.(i / frames);
  }
  const win = 5;
  const dx: number[] = [];
  const dy: number[] = [];
  for (let i = 0; i < rawX.length; i++) {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let j = i - win; j <= i + win; j++) {
      if (j < 0 || j >= rawX.length) continue;
      sx += rawX[j] ?? 0;
      sy += rawY[j] ?? 0;
      n++;
    }
    const mx = sx / n;
    const my = sy / n;
    dx.push((rawX[i] ?? 0) - mx);
    dy.push((rawY[i] ?? 0) - my);
  }
  onProgress?.(1);
  return { fps, dx, dy };
}

export function stabOffset(clip: Clip, mediaTimeMs: number): { dx: number; dy: number } {
  const amt = clip.stabilize ?? 0;
  const series = clip.stab;
  if (!series || amt < 0.02 || !series.dx.length) return { dx: 0, dy: 0 };
  const i = Math.max(0, Math.min(series.dx.length - 1, Math.round((mediaTimeMs / 1000) * series.fps)));
  return { dx: -(series.dx[i] ?? 0) * amt, dy: -(series.dy[i] ?? 0) * amt };
}
