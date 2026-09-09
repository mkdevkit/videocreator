import type { Clip, Project, Track, TrackKind } from "../types";
import { DEFAULT_EXPORT, DEFAULT_TEXT_STYLE, DEFAULT_TRANSFORM, TRACK_ORDER } from "../types";
import { uid } from "./ids";

export function clipSpeed(c: Clip): number {
  const s = c.speed && Number.isFinite(c.speed) ? c.speed : 1;
  return Math.min(2, Math.max(0.5, s));
}

export function clipDuration(c: Clip): number {
  return Math.max(0, (c.outMs - c.inMs) / clipSpeed(c));
}

export function clipEnd(c: Clip): number {
  return c.startMs + clipDuration(c);
}

export function sortedSpeedKeys(clip: Clip) {
  return [...(clip.speedKeys ?? [])].sort((a, b) => a.tMs - b.tMs);
}

export function sampleSpeed(clip: Clip, timelineMs: number): number {
  const keys = sortedSpeedKeys(clip);
  const rest = clipSpeed(clip);
  if (!keys.length) return rest;
  const local = Math.max(0, Math.min(clipDuration(clip), timelineMs - clip.startMs));
  const clamp = (s: number) => Math.min(4, Math.max(0.25, s));
  if (local <= keys[0].tMs) return clamp(keys[0].speed);
  const last = keys[keys.length - 1];
  if (local >= last.tMs) return clamp(last.speed);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (local >= a.tMs && local <= b.tMs) {
      const t = (local - a.tMs) / Math.max(1, b.tMs - a.tMs);
      return clamp(a.speed + (b.speed - a.speed) * t);
    }
  }
  return rest;
}

function integrateSpeed(clip: Clip, toLocal: number): number {
  const keys = sortedSpeedKeys(clip);
  if (!keys.length) return toLocal * clipSpeed(clip);
  const clamp = (s: number) => Math.min(4, Math.max(0.25, s));
  const dur = clipDuration(clip);
  const end = Math.max(0, Math.min(dur, toLocal));
  let acc = 0;
  let t = 0;
  let spd = clamp(keys[0].speed);
  const pts = [...keys];
  if (pts[0].tMs > 0) pts.unshift({ tMs: 0, speed: pts[0].speed });
  if (pts[pts.length - 1].tMs < end) pts.push({ tMs: end, speed: pts[pts.length - 1].speed });
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (b.tMs <= t) continue;
    const from = Math.max(t, a.tMs);
    const to = Math.min(end, b.tMs);
    if (to <= from) continue;
    const sa = clamp(a.speed);
    const sb = clamp(b.speed);
    const u0 = (from - a.tMs) / Math.max(1, b.tMs - a.tMs);
    const u1 = (to - a.tMs) / Math.max(1, b.tMs - a.tMs);
    const s0 = sa + (sb - sa) * u0;
    const s1 = sa + (sb - sa) * u1;
    acc += ((s0 + s1) / 2) * (to - from);
    t = to;
    spd = s1;
    if (t >= end) break;
  }
  if (t < end) acc += spd * (end - t);
  return acc;
}

export function mediaTimeMs(clip: Clip, timelineMs: number, fileDurationMs?: number): number {
  const local = Math.max(0, timelineMs - clip.startMs);
  const speed = clipSpeed(clip);
  const span = Math.max(1, clip.outMs - clip.inMs);
  const fileEnd = fileDurationMs && fileDurationMs > 0 ? fileDurationMs : clip.outMs;
  const off = (clip.speedKeys ?? []).length ? integrateSpeed(clip, local) : local * speed;
  if (clip.loop) {
    const cycle = Math.max(1, (fileDurationMs && fileDurationMs > 0 ? fileDurationMs : Math.max(clip.outMs, clip.inMs + 1)) - clip.inMs);
    const wrapped = off % cycle;
    const t = clip.reverse ? cycle - wrapped : wrapped;
    return Math.min(Math.max(0, clip.inMs + t), Math.max(0, fileEnd - 1));
  }
  const t = clip.reverse ? span - off : off;
  return Math.min(Math.max(0, clip.inMs + t), Math.max(0, fileEnd - 1));
}

export function duckPresence(project: Project, ms: number, fadeMs = 140): number {
  let peak = 0;
  for (const clip of project.clips) {
    const track = project.tracks.find((t) => t.id === clip.trackId);
    if (track?.kind !== "voice" || track.muted) continue;
    const start = clip.startMs;
    const end = clipEnd(clip);
    if (ms < start - fadeMs || ms > end + fadeMs) continue;
    let a = 1;
    if (ms < start) a = 1 - (start - ms) / fadeMs;
    else if (ms > end) a = 1 - (ms - end) / fadeMs;
    peak = Math.max(peak, Math.min(1, Math.max(0, a)));
  }
  return peak;
}

export function duckGain(project: Project, clip: Clip, ms: number): number {
  const track = project.tracks.find((t) => t.id === clip.trackId);
  if (track?.kind !== "music" || clip.duck === false) return 1;
  const to = Number.isFinite(clip.duckTo) ? Math.min(1, Math.max(0, clip.duckTo)) : 0.22;
  return 1 - duckPresence(project, ms) * (1 - to);
}

export function workRange(project: Project): { from: number; to: number; active: boolean } {
  const end = Math.max(0, projectDuration(project));
  const hasIn = typeof project.workInMs === "number";
  const hasOut = typeof project.workOutMs === "number";
  if (!hasIn && !hasOut) return { from: 0, to: end, active: false };
  let from = hasIn ? Math.max(0, project.workInMs as number) : 0;
  let to = hasOut ? Math.max(0, project.workOutMs as number) : end;
  if (to <= from) to = from + 1000;
  if (end > 0) to = Math.min(to, end);
  return { from, to, active: true };
}

export function projectDuration(project: Project): number {
  if (!project.clips.length) return 0;
  return Math.max(0, ...project.clips.map(clipEnd));
}

export function tracksOfKind(project: Project, kind: TrackKind): Track[] {
  return project.tracks.filter((t) => t.kind === kind);
}

export function clipsOnTrack(project: Project, trackId: string): Clip[] {
  return project.clips.filter((c) => c.trackId === trackId).sort((a, b) => a.startMs - b.startMs);
}

export function clipsAt(project: Project, ms: number, kind?: TrackKind): Clip[] {
  return project.clips.filter((c) => {
    if (ms < c.startMs || ms >= clipEnd(c)) return false;
    if (!kind) return true;
    const track = project.tracks.find((t) => t.id === c.trackId);
    return track?.kind === kind;
  });
}

export function sortedTracks(project: Project): Track[] {
  return [...project.tracks].sort((a, b) => TRACK_ORDER.indexOf(a.kind) - TRACK_ORDER.indexOf(b.kind));
}

export function emptyProject(name = "未命名剪辑"): Project {
  const mk = (kind: TrackKind, label: string): Track => ({
    id: uid("tr"),
    kind,
    name: label,
    muted: false,
    locked: false,
  });
  return {
    name,
    aspect: "16:9",
    fps: 24,
    media: [],
    tracks: [
      mk("text", "文字"),
      mk("adjust", "调节"),
      mk("videoOverlay", "叠加"),
      mk("videoMain", "主视频"),
      mk("audioLinked", "原声"),
      mk("voice", "配音"),
      mk("music", "音乐"),
      mk("sfx", "音效"),
    ],
    clips: [],
    markers: [],
    workInMs: null,
    workOutMs: null,
    nests: [],
    customLooks: [],
    exportSettings: { ...DEFAULT_EXPORT },
  };
}

export function defaultClip(trackId: string, startMs: number, durationMs: number, extra: Partial<Clip> = {}): Clip {
  return {
    id: uid("cl"),
    trackId,
    startMs: Math.max(0, startMs),
    inMs: 0,
    outMs: Math.max(1, durationMs),
    volume: 1,
    fadeInMs: 0,
    fadeOutMs: 0,
    transform: { ...DEFAULT_TRANSFORM },
    transition: "cut",
    transitionMs: 400,
    speed: 1,
    loop: false,
    reverse: false,
    duck: true,
    duckTo: 0.22,
    grade: { brightness: 1, contrast: 1, saturate: 1 },
    look: "none",
    vignette: 0,
    keys: [],
    volKeys: [],
    speedKeys: [],
    fx: { blur: 0, hue: 0, sepia: 0, grayscale: 0 },
    chroma: { enabled: false, color: "#00ff00", similarity: 0.28, smoothness: 0.12 },
    audioFx: { denoise: 0, low: 0, mid: 0, high: 0 },
    stabilize: 0,
    ...extra,
  };
}

export function textClip(trackId: string, startMs: number, durationMs: number, text: string): Clip {
  return defaultClip(trackId, startMs, durationMs, { text, textStyle: { ...DEFAULT_TEXT_STYLE } });
}

export function snapMs(ms: number, points: number[], thresh = 120): number {
  let best = ms;
  let d = thresh;
  for (const p of points) {
    const gap = Math.abs(ms - p);
    if (gap < d) {
      d = gap;
      best = p;
    }
  }
  return Math.max(0, best);
}

export function snapPoints(project: Project, ignoreIds: string[], playheadMs: number): number[] {
  const pts = [0, playheadMs];
  for (const c of project.clips) {
    if (ignoreIds.includes(c.id)) continue;
    pts.push(c.startMs, clipEnd(c));
  }
  for (const m of project.markers ?? []) pts.push(m.ms);
  return pts;
}

export function transitionMix(outgoing: Clip, incoming: Clip | undefined, ms: number): { a: Clip; b?: Clip; t: number } | null {
  if (!incoming || outgoing.transition === "cut" || outgoing.transitionMs <= 0) return null;
  const end = clipEnd(outgoing);
  const start = end - outgoing.transitionMs;
  if (ms < start || ms >= end) return null;
  const t = (ms - start) / outgoing.transitionMs;
  return { a: outgoing, b: incoming, t: Math.min(1, Math.max(0, t)) };
}

export function formatMs(ms: number, fps = 24): string {
  const v = Math.max(0, ms);
  const h = Math.floor(v / 3600000);
  const m = Math.floor((v % 3600000) / 60000);
  const s = Math.floor((v % 60000) / 1000);
  const f = Math.floor((v % 1000) / (1000 / fps));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(s)}:${p(f)}`;
}

export function nextOnTrack(project: Project, clip: Clip): Clip | undefined {
  const next = clipsOnTrack(project, clip.trackId).find((c) => c.startMs >= clipEnd(clip) - 1 && c.id !== clip.id);
  if (!next) return undefined;
  if (next.startMs - clipEnd(clip) > 40) return undefined;
  return next;
}
