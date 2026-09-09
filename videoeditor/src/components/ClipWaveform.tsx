import { useEffect, useRef } from "react";
import type { Clip } from "../types";
import { clipDuration, mediaTimeMs } from "../lib/timeline";
import { ensurePeaks, peaksOf } from "../lib/waveform";

export function ClipWaveform({
  clip,
  mediaDurationMs,
  width,
  height,
  color,
}: {
  clip: Clip;
  mediaDurationMs: number;
  width: number;
  height: number;
  color: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!clip.mediaId) return;
    let alive = true;
    const draw = (peaks: Float32Array) => {
      const el = canvas.current;
      if (!el || !alive || width < 2) return;
      const dpr = window.devicePixelRatio || 1;
      el.width = Math.max(1, Math.round(width * dpr));
      el.height = Math.max(1, Math.round(height * dpr));
      const ctx = el.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;
      const dur = Math.max(1, clipDuration(clip));
      const mid = height / 2;
      const cols = Math.max(8, Math.floor(width));
      for (let x = 0; x < cols; x++) {
        const local = (x / cols) * dur;
        const mediaMs = mediaTimeMs(clip, clip.startMs + local, mediaDurationMs);
        const idx = Math.min(peaks.length - 1, Math.max(0, Math.round((mediaMs / Math.max(1, mediaDurationMs)) * (peaks.length - 1))));
        const amp = peaks[idx] ?? 0;
        const h = Math.max(1, amp * (height - 2));
        ctx.fillRect(x, mid - h / 2, 1, h);
      }
    };
    const cached = peaksOf(clip.mediaId);
    if (cached) draw(cached);
    else void ensurePeaks(clip.mediaId).then((p) => p && draw(p));
    return () => {
      alive = false;
    };
  }, [clip, mediaDurationMs, width, height, color]);

  return <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />;
}
