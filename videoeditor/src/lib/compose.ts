import type { Clip, Project } from "../types";
import { ASPECT_PX } from "../types";
import { fontCss } from "./fonts";
import { getImageEl, getVideoEl, seekVideo } from "./media";
import { clipEnd, clipSpeed, clipsAt, duckGain, mediaTimeMs, nextOnTrack, sortedTracks, transitionMix } from "./timeline";
import { envelopeGain, hitTestClip, sampleTransform } from "./keys";
import { cssFilter } from "./looks";
import { chromaSource } from "./chroma";
import { nestAsProject } from "./ops";
import { sampleMulticamMedia } from "./multicam";
import { stabOffset } from "./stabilize";
import { drawSticker, stickerOf } from "./stickers";

export function canvasSize(project: Project, height: number): { w: number; h: number } {
  const base = ASPECT_PX[project.aspect];
  const scale = height / base.h;
  return { w: Math.round(base.w * scale), h: height };
}

function drawMedia(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  clip: Clip,
  w: number,
  h: number,
  timelineMs: number,
  extraOpacity = 1,
) {
  const t = sampleTransform(clip, timelineMs);
  const opacity = t.opacity * extraOpacity;
  if (opacity <= 0.01) return;
  const filter = cssFilter(clip.grade, clip.fx);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.filter = filter;
  const cx = (t.x / 100) * w;
  const cy = (t.y / 100) * h;
  const dw = w * t.scale;
  const dh = h * t.scale;
  const stab = stabOffset(clip, mediaTimeMs(clip, timelineMs, clip.outMs));
  ctx.translate(cx + stab.dx * w, cy + stab.dy * h);
  ctx.rotate(((t.rotation ?? 0) * Math.PI) / 180);
  const keyed = chromaSource(source, clip.chroma, dw, dh);
  ctx.drawImage(keyed, -dw / 2, -dh / 2, dw, dh);
  ctx.filter = "none";
  const vig = clip.vignette ?? 0;
  if (vig > 0.01) {
    const g = ctx.createRadialGradient(0, 0, Math.min(dw, dh) * 0.22, 0, 0, Math.max(dw, dh) * 0.62);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${Math.min(1, vig)})`);
    ctx.fillStyle = g;
    ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
  }
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, clip: Clip, w: number, h: number, timelineMs: number) {
  if (!clip.text) return;
  const st = clip.textStyle;
  if (!st) return;
  const pose = sampleTransform(clip, timelineMs);
  ctx.save();
  ctx.globalAlpha = pose.opacity;
  const italic = st.italic ? "italic " : "";
  const weight = st.weight === 700 ? "700 " : "400 ";
  ctx.font = `${italic}${weight}${Math.round((st.fontSize / 100) * h)}px ${fontCss(st.fontId)}`;
  ctx.fillStyle = st.color;
  ctx.strokeStyle = st.stroke;
  ctx.lineWidth = (st.strokeWidth / 100) * h;
  if ((st.shadow ?? 0) > 0.02) {
    ctx.shadowColor = st.shadowColor || "#000000";
    ctx.shadowBlur = (st.shadow / 100) * h * 8;
    ctx.shadowOffsetY = (st.shadow / 100) * h * 2;
  }
  ctx.textAlign = st.align;
  ctx.textBaseline = "middle";
  const x = st.align === "left" ? w * 0.08 : st.align === "right" ? w * 0.92 : w / 2;
  const y = (pose.y / 100) * h;
  ctx.translate(x, y);
  ctx.rotate(((pose.rotation ?? 0) * Math.PI) / 180);
  const lines = clip.text.split("\n");
  const lh = (st.fontSize / 100) * h * 1.25;
  const startY = -((lines.length - 1) * lh) / 2;
  lines.forEach((line, i) => {
    const yy = startY + i * lh;
    if (st.strokeWidth > 0) ctx.strokeText(line, 0, yy);
    ctx.fillText(line, 0, yy);
  });
  ctx.restore();
}

function drawStickerClip(ctx: CanvasRenderingContext2D, clip: Clip, w: number, h: number, timelineMs: number) {
  const def = stickerOf(clip.stickerId);
  if (!def) return;
  const pose = sampleTransform(clip, timelineMs);
  if (pose.opacity <= 0.01) return;
  const size = Math.min(w, h) * 0.18 * pose.scale;
  ctx.save();
  ctx.globalAlpha = pose.opacity;
  ctx.translate((pose.x / 100) * w, (pose.y / 100) * h);
  ctx.rotate(((pose.rotation ?? 0) * Math.PI) / 180);
  drawSticker(ctx, def.glyph, size, clip.textStyle?.color ?? "#f3eee3");
  ctx.restore();
}

function mixOpacity(kind: Clip["transition"], t: number, outgoing: boolean): number {
  if (kind === "fade") return outgoing ? 1 - t : t;
  if (kind === "dissolve") return outgoing ? 1 - t : t;
  return 1;
}

const plates: HTMLCanvasElement[] = [];

function plate(slot: number, w: number, h: number, depth = 0): HTMLCanvasElement {
  const i = depth * 8 + slot;
  let c = plates[i];
  if (!c) {
    c = document.createElement("canvas");
    plates[i] = c;
  }
  if (c.width !== w || c.height !== h) {
    c.width = w;
    c.height = h;
  }
  return c;
}

function applyAdjust(dst: CanvasRenderingContext2D, src: HTMLCanvasElement, clip: Clip, w: number, h: number, ms: number) {
  const mix = sampleTransform(clip, ms).opacity;
  dst.clearRect(0, 0, w, h);
  dst.drawImage(src, 0, 0);
  if (mix <= 0.01) return;
  const filter = cssFilter(clip.grade, clip.fx);
  if (filter !== "none") {
    dst.save();
    dst.globalAlpha = mix;
    dst.filter = filter;
    dst.drawImage(src, 0, 0);
    dst.restore();
  }
  const vig = clip.vignette ?? 0;
  if (vig > 0.01) {
    const g = dst.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.22, w / 2, h / 2, Math.hypot(w, h) * 0.55);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${Math.min(1, vig * mix)})`);
    dst.fillStyle = g;
    dst.fillRect(0, 0, w, h);
  }
}

export async function drawFrame(
  ctx: CanvasRenderingContext2D,
  project: Project,
  ms: number,
  w: number,
  h: number,
  opts: { precise?: boolean; burnCaptions?: boolean; depth?: number } = {},
) {
  const depth = opts.depth ?? 0;
  if (depth > 3) return;
  const base = plate(0, w, h, depth);
  const pctx = base.getContext("2d");
  if (!pctx) return;
  pctx.fillStyle = "#0b0d10";
  pctx.fillRect(0, 0, w, h);

  const mains = clipsAt(project, ms, "videoMain").sort((a, b) => a.startMs - b.startMs);
  const overlays = clipsAt(project, ms, "videoOverlay");
  const texts = clipsAt(project, ms, "text");
  const precise = opts.precise ?? true;
  const showText = opts.burnCaptions !== false;

  const drawVideoClip = async (clip: Clip, extra = 1, sourceMs?: number) => {
    if (clip.nestId && depth < 3) {
      const inner = nestAsProject(project, clip.nestId);
      if (inner) {
        const local = mediaTimeMs(clip, ms, clip.outMs);
        const off = plate(4, w, h, depth);
        const nctx = off.getContext("2d");
        if (nctx) {
          await drawFrame(nctx, inner, local, w, h, { ...opts, depth: depth + 1 });
          drawMedia(pctx, off, clip, w, h, ms, extra);
        }
      }
      return;
    }
    const mediaId = sampleMulticamMedia(clip, ms);
    if (!mediaId) return;
    const media = project.media.find((m) => m.id === mediaId);
    if (!media) return;
    const localS = (sourceMs ?? mediaTimeMs(clip, ms, media.durationMs)) / 1000;
    const reverse = Boolean(clip.reverse);
    if (media.kind === "image") {
      const img = getImageEl(media.id);
      if (img) drawMedia(pctx, img, clip, w, h, ms, extra);
      return;
    }
    if (precise || reverse) {
      const video = await seekVideo(media.id, localS);
      if (video) {
        video.pause();
        video.playbackRate = clipSpeed(clip);
        drawMedia(pctx, video, clip, w, h, ms, extra);
      }
      return;
    }
    const video = getVideoEl(media.id);
    if (!video) return;
    video.playbackRate = clipSpeed(clip);
    if (Math.abs(video.currentTime - localS) > 0.08) video.currentTime = Math.max(0, localS);
    if (video.paused) void video.play().catch(() => undefined);
    if (video.readyState >= 2) drawMedia(pctx, video, clip, w, h, ms, extra);
  };

  if (mains.length) {
    const current = mains[mains.length - 1];
    const next = nextOnTrack(project, current);
    const mix = transitionMix(current, next, ms);
    if (mix?.b && current.transition !== "cut") {
      await drawVideoClip(mix.a, mixOpacity(current.transition, mix.t, true));
      const early = mix.b.inMs + mix.t * current.transitionMs * clipSpeed(mix.b);
      await drawVideoClip(mix.b, mixOpacity(current.transition, mix.t, false), early);
    } else {
      await drawVideoClip(current);
    }
  } else if (nextPeek(project, ms)) {
    const peek = nextPeek(project, ms)!;
    const prev = clipsOnTrackMainBefore(project, peek);
    if (prev) {
      const mix = transitionMix(prev, peek, ms);
      if (mix?.b) {
        const early = peek.inMs + mix.t * prev.transitionMs * clipSpeed(peek);
        await drawVideoClip(peek, mixOpacity(prev.transition ?? "cut", mix.t, false), early);
      }
    }
  }

  for (const clip of overlays) await drawVideoClip(clip);

  const trackOrder = sortedTracks(project);
  const adjusts = clipsAt(project, ms, "adjust").sort(
    (a, b) => trackOrder.findIndex((t) => t.id === a.trackId) - trackOrder.findIndex((t) => t.id === b.trackId),
  );
  let src = base;
  let slot = 0;
  for (const adj of adjusts) {
    const track = project.tracks.find((t) => t.id === adj.trackId);
    if (track?.muted) continue;
    slot = slot === 0 ? 1 : 0;
    const dst = plate(slot, w, h, depth);
    const dctx = dst.getContext("2d");
    if (!dctx) continue;
    applyAdjust(dctx, src, adj, w, h, ms);
    src = dst;
  }

  ctx.drawImage(src, 0, 0);
  if (showText) {
    for (const clip of texts) {
      if (clip.stickerId) drawStickerClip(ctx, clip, w, h, ms);
      else drawText(ctx, clip, w, h, ms);
    }
  }
}

function clipsOnTrackMainBefore(project: Project, clip: Clip): Clip | undefined {
  return project.clips
    .filter((c) => c.trackId === clip.trackId && clipEnd(c) <= clip.startMs + 1)
    .sort((a, b) => clipEnd(b) - clipEnd(a))[0];
}

function nextPeek(project: Project, ms: number): Clip | undefined {
  return project.clips
    .filter((c) => {
      const track = project.tracks.find((t) => t.id === c.trackId);
      if (track?.kind !== "videoMain") return false;
      const prev = clipsOnTrackMainBefore(project, c);
      if (!prev || prev.transition === "cut" || prev.transitionMs <= 0) return false;
      const win = clipEnd(prev) - prev.transitionMs;
      return ms >= win && ms < c.startMs;
    })
    .sort((a, b) => a.startMs - b.startMs)[0];
}

export function activeAudioClips(project: Project, ms: number, depth = 0): { clip: Clip; gain: number }[] {
  const kinds = ["audioLinked", "voice", "music", "sfx"] as const;
  const out: { clip: Clip; gain: number }[] = [];
  for (const kind of kinds) {
    for (const clip of clipsAt(project, ms, kind)) {
      const track = project.tracks.find((t) => t.id === clip.trackId);
      if (track?.muted) continue;
      out.push({ clip, gain: envelopeGain(clip, ms) * duckGain(project, clip, ms) });
    }
  }
  if (depth >= 3) return out;
  for (const clip of project.clips) {
    if (!clip.nestId || ms < clip.startMs || ms >= clipEnd(clip)) continue;
    const inner = nestAsProject(project, clip.nestId);
    if (!inner) continue;
    const local = mediaTimeMs(clip, ms, clip.outMs);
    const mul = envelopeGain(clip, ms);
    for (const row of activeAudioClips(inner, local, depth + 1)) out.push({ clip: row.clip, gain: row.gain * mul });
  }
  return out;
}

export function hitVisualClip(project: Project, ms: number, nx: number, ny: number): Clip | null {
  const layers = [
    ...clipsAt(project, ms, "text").reverse(),
    ...clipsAt(project, ms, "videoOverlay").reverse(),
    ...clipsAt(project, ms, "videoMain").reverse(),
  ];
  return layers.find((c) => hitTestClip(c, ms, nx, ny)) ?? null;
}
