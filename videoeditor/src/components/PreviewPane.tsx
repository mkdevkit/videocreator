import { useEffect, useRef } from "react";
import { ASPECT_PX } from "../types";
import { hitVisualClip } from "../lib/compose";
import { sampleTransform } from "../lib/keys";
import { patchTransform } from "../lib/ops";
import { poseSelected, useStudio, useViewProject, viewProject } from "../store/useStudio";
import { usePreviewCanvas } from "./Playback";

export function PreviewPane() {
  const project = useViewProject();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  usePreviewCanvas(canvasRef, true);
  const size = ASPECT_PX[project.aspect];

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      const s = useStudio.getState();
      if (!s.selectedClipId) return;
      const view = viewProject(s.project, s.editingNestId);
      const clip = view.clips.find((c) => c.id === s.selectedClipId);
      if (!clip) return;
      e.preventDefault();
      const start = sampleTransform(clip, s.playheadMs);
      if (e.shiftKey) poseSelected({ rotation: (start.rotation ?? 0) + (e.deltaY > 0 ? 3 : -3) });
      else poseSelected({ scale: Math.min(3, Math.max(0.1, start.scale * (e.deltaY > 0 ? 0.94 : 1.06))) });
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <main className="relative flex min-w-0 flex-1 flex-col bg-ink-950">
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <div
          ref={wrapRef}
          className="relative max-h-full max-w-full overflow-hidden rounded-md border border-ink-600 bg-black shadow-paper"
          style={{ aspectRatio: `${size.w} / ${size.h}`, width: "min(100%, 960px)" }}
          onMouseDown={(e) => {
            const wrap = wrapRef.current;
            if (!wrap) return;
            const rect = wrap.getBoundingClientRect();
            const nx = (e.clientX - rect.left) / rect.width;
            const ny = (e.clientY - rect.top) / rect.height;
            const s = useStudio.getState();
            const view = viewProject(s.project, s.editingNestId);
            const hit = hitVisualClip(view, s.playheadMs, nx, ny);
            if (!hit) return;
            e.preventDefault();
            s.setSelected(hit.id, hit.trackId);
            s.setPlaying(false);
            s.commit();
            const start = sampleTransform(hit, s.playheadMs);
            const ox = e.clientX;
            const oy = e.clientY;
            const move = (ev: MouseEvent) => {
              const dx = ((ev.clientX - ox) / rect.width) * 100;
              const dy = ((ev.clientY - oy) / rect.height) * 100;
              useStudio.getState().mutate(
                (p) => patchTransform(p, hit.id, useStudio.getState().playheadMs, { x: start.x + dx, y: start.y + dy }),
                false,
              );
            };
            const up = () => {
              window.removeEventListener("mousemove", move);
              window.removeEventListener("mouseup", up);
            };
            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", up);
          }}
        >
          <canvas ref={canvasRef} className="pointer-events-none h-full w-full object-contain" />
        </div>
      </div>
      <div className="shrink-0 border-t border-ink-600 px-3 py-1 text-[10px] text-ink-400">
        预览拖位置 · 滚轮缩放 · Shift+滚轮旋转 · 叠加同时可见建议不超过 2 路
      </div>
    </main>
  );
}
