import { useEffect, useRef, type RefObject } from "react";
import { canvasSize, drawFrame } from "../lib/compose";
import { stopAllAudio, syncAudio } from "../lib/audio";
import { pauseAllVideos } from "../lib/media";
import { workRange } from "../lib/timeline";
import { durationOf, useStudio, useViewProject, viewProject } from "../store/useStudio";

export function Playback() {
  const playing = useStudio((s) => s.playing);
  const raf = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(raf.current);
      stopAllAudio();
      last.current = 0;
      pauseAllVideos();
      return;
    }
    last.current = performance.now();
    const tick = (now: number) => {
      const s = useStudio.getState();
      const dt = now - last.current;
      last.current = now;
      const next = s.playheadMs + dt;
      const view = viewProject(s.project, s.editingNestId);
      const range = workRange(view);
      const end = range.active ? range.to : durationOf(view);
      if (next >= end) {
        if (s.loopWork && range.active) {
          s.setPlayhead(range.from);
        } else {
          s.setPlayhead(end);
          s.setPlaying(false);
          return;
        }
      } else {
        s.setPlayhead(next);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  useEffect(() => {
    return () => stopAllAudio();
  }, []);

  return null;
}

export function usePreviewCanvas(canvasRef: RefObject<HTMLCanvasElement>, preview: boolean) {
  const project = useViewProject();
  const playheadMs = useStudio((s) => s.playheadMs);
  const playing = useStudio((s) => s.playing);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = canvasSize(project, 720);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let cancelled = false;
    void drawFrame(ctx, project, playheadMs, w, h, { precise: !playing, burnCaptions: true }).then(() => {
      if (cancelled) return;
    });
    if (preview) syncAudio(project, playheadMs, playing);
    return () => {
      cancelled = true;
    };
  }, [canvasRef, project, playheadMs, playing, preview]);
}
