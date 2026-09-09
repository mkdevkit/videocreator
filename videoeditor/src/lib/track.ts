import type { Clip, TransformKey } from "../types";
import { DEFAULT_TRANSFORM } from "../types";
import { sampleTransform } from "./keys";
import { clipDuration, mediaTimeMs } from "./timeline";
import { probeVideo } from "./media";

function patchAt(data: Uint8ClampedArray, w: number, x: number, y: number, tw: number, th: number): number[] {
  const out: number[] = [];
  for (let yy = y; yy < y + th; yy++) {
    for (let xx = x; xx < x + tw; xx++) {
      const i = (Math.max(0, Math.min(w - 1, xx)) + Math.max(0, yy) * w) * 4;
      out.push(0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0));
    }
  }
  return out;
}

function sad(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  return s;
}

export async function trackPoint(
  clip: Clip,
  mediaId: string,
  fromTimelineMs: number,
  nx: number,
  ny: number,
  onProgress?: (r: number) => void,
): Promise<TransformKey[]> {
  const end = clip.startMs + clipDuration(clip);
  const step = 80;
  const pose0 = sampleTransform(clip, fromTimelineMs);
  const w = 160;
  const h = 90;
  const tw = 12;
  const th = 10;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  const firstT = mediaTimeMs(clip, fromTimelineMs, clip.outMs) / 1000;
  const video0 = await probeVideo(mediaId, firstT);
  if (!video0) return [];
  ctx.drawImage(video0, 0, 0, w, h);
  let px = Math.round(nx * w - tw / 2);
  let py = Math.round(ny * h - th / 2);
  const tmpl = patchAt(ctx.getImageData(0, 0, w, h).data, w, px, py, tw, th);
  const keys: TransformKey[] = [
    { tMs: Math.max(0, fromTimelineMs - clip.startMs), transform: { ...DEFAULT_TRANSFORM, ...pose0, x: nx * 100, y: ny * 100 } },
  ];
  const span = Math.max(1, end - fromTimelineMs);
  for (let t = fromTimelineMs + step; t <= end; t += step) {
    const mediaT = mediaTimeMs(clip, t, clip.outMs) / 1000;
    const video = await probeVideo(mediaId, mediaT);
    if (!video) continue;
    ctx.drawImage(video, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let best = 1e12;
    let bx = px;
    let by = py;
    for (let oy = -8; oy <= 8; oy++) {
      for (let ox = -10; ox <= 10; ox++) {
        const d = sad(tmpl, patchAt(data, w, px + ox, py + oy, tw, th));
        if (d < best) {
          best = d;
          bx = px + ox;
          by = py + oy;
        }
      }
    }
    px = bx;
    py = by;
    const x = ((px + tw / 2) / w) * 100;
    const y = ((py + th / 2) / h) * 100;
    keys.push({
      tMs: Math.max(0, t - clip.startMs),
      transform: { ...DEFAULT_TRANSFORM, ...pose0, x, y },
    });
    onProgress?.((t - fromTimelineMs) / span);
  }
  onProgress?.(1);
  return keys;
}
