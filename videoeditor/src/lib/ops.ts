import type { Clip, Project, TrackKind, Transform } from "../types";
import { TRACK_LABEL } from "../types";
import { clipDuration, clipEnd, clipSpeed, clipsOnTrack, defaultClip, snapMs, snapPoints } from "./timeline";
import { removeKeyAt, removeSpeedKeyAt, removeVolKeyAt, scaleKeys, scaleSpeedKeys, scaleVolKeys, shiftKeys, shiftSpeedKeys, shiftVolKeys, writeSpeedKey, writeTransform, writeVolume } from "./keys";
import { uid } from "./ids";
import { splitMulticam } from "./multicam";

const VIDEO_KINDS: TrackKind[] = ["videoMain", "videoOverlay"];
const AUDIO_KINDS: TrackKind[] = ["audioLinked", "voice", "music", "sfx"];

export function compatibleKind(from: TrackKind, to: TrackKind): boolean {
  if (from === to) return true;
  if (VIDEO_KINDS.includes(from) && VIDEO_KINDS.includes(to)) return true;
  if (AUDIO_KINDS.includes(from) && AUDIO_KINDS.includes(to) && from !== "audioLinked" && to !== "audioLinked") return true;
  return false;
}

export function nextGapStart(project: Project, trackId: string): number {
  const clips = clipsOnTrack(project, trackId);
  if (!clips.length) return 0;
  return clipEnd(clips[clips.length - 1]);
}

export function splitClip(project: Project, clipId: string, atMs: number): Project {
  const clip = project.clips.find((c) => c.id === clipId);
  if (!clip) return project;
  const local = atMs - clip.startMs;
  if (local <= 40 || local >= clipDuration(clip) - 40) return project;
  const mediaCut = clip.inMs + local * clipSpeed(clip);
  const cams = splitMulticam(clip.multicam, local);
  const left: Clip = {
    ...clip,
    outMs: mediaCut,
    keys: shiftKeys(clip.keys, 0, local),
    volKeys: shiftVolKeys(clip.volKeys, 0, local),
    speedKeys: shiftSpeedKeys(clip.speedKeys, 0, local),
    multicam: cams.left,
  };
  const right: Clip = {
    ...clip,
    id: uid("cl"),
    startMs: atMs,
    inMs: mediaCut,
    linkedClipId: undefined,
    keys: shiftKeys(clip.keys, -local, clipDuration(clip) - local),
    volKeys: shiftVolKeys(clip.volKeys, -local, clipDuration(clip) - local),
    speedKeys: shiftSpeedKeys(clip.speedKeys, -local, clipDuration(clip) - local),
    multicam: cams.right,
  };
  let clips = project.clips.map((c) => (c.id === clipId ? left : c)).concat(right);
  if (clip.linkedClipId) {
    const linked = project.clips.find((c) => c.id === clip.linkedClipId);
    if (linked) {
      const ll = atMs - linked.startMs;
      if (ll > 40 && ll < clipDuration(linked) - 40) {
        const lLeft: Clip = {
          ...linked,
          outMs: linked.inMs + ll * clipSpeed(linked),
          keys: shiftKeys(linked.keys, 0, ll),
          volKeys: shiftVolKeys(linked.volKeys, 0, ll),
          speedKeys: shiftSpeedKeys(linked.speedKeys, 0, ll),
        };
        const lRight: Clip = {
          ...linked,
          id: uid("cl"),
          startMs: atMs,
          inMs: linked.inMs + ll * clipSpeed(linked),
          linkedClipId: right.id,
          keys: shiftKeys(linked.keys, -ll, clipDuration(linked) - ll),
          volKeys: shiftVolKeys(linked.volKeys, -ll, clipDuration(linked) - ll),
          speedKeys: shiftSpeedKeys(linked.speedKeys, -ll, clipDuration(linked) - ll),
        };
        right.linkedClipId = lRight.id;
        lLeft.linkedClipId = left.id;
        left.linkedClipId = lLeft.id;
        clips = clips.map((c) => (c.id === linked.id ? lLeft : c)).concat(lRight);
      }
    }
  }
  return { ...project, clips };
}

export function deleteClip(project: Project, clipId: string, ripple: boolean): Project {
  const clip = project.clips.find((c) => c.id === clipId);
  if (!clip) return project;
  const linked = clip.linkedClipId ? project.clips.find((c) => c.id === clip.linkedClipId) : undefined;
  const dur = clipDuration(clip);
  const ids = new Set([clipId]);
  if (linked) ids.add(linked.id);
  const trackIds = new Set([clip.trackId]);
  if (linked) trackIds.add(linked.trackId);
  const end = clipEnd(clip);
  let clips = project.clips.filter((c) => !ids.has(c.id));
  if (ripple) {
    clips = clips.map((c) => {
      if (!trackIds.has(c.trackId)) return c;
      if (c.startMs >= end) return { ...c, startMs: Math.max(0, c.startMs - dur) };
      return c;
    });
  }
  return { ...project, clips };
}

export function moveClip(project: Project, clipId: string, trackId: string, startMs: number, playheadMs: number): Project {
  const clip = project.clips.find((c) => c.id === clipId);
  const from = project.tracks.find((t) => t.id === clip?.trackId);
  const to = project.tracks.find((t) => t.id === trackId);
  if (!clip || !from || !to || to.locked) return project;
  if (!compatibleKind(from.kind, to.kind)) return project;
  const snapped = snapMs(Math.max(0, startMs), snapPoints(project, [clipId, clip.linkedClipId ?? ""], playheadMs));
  const delta = snapped - clip.startMs;
  let next = project.clips.map((c) => (c.id === clipId ? { ...c, trackId, startMs: snapped } : c));
  if (clip.linkedClipId && from.kind === to.kind) {
    next = next.map((c) => (c.id === clip.linkedClipId ? { ...c, startMs: c.startMs + delta } : c));
  } else if (clip.linkedClipId && from.kind !== to.kind) {
    next = next.map((c) => (c.id === clipId ? { ...c, linkedClipId: undefined } : c.id === clip.linkedClipId ? { ...c, linkedClipId: undefined } : c));
  }
  return { ...project, clips: next };
}

export function trimClip(project: Project, clipId: string, edge: "in" | "out", ms: number, playheadMs: number): Project {
  const clip = project.clips.find((c) => c.id === clipId);
  if (!clip) return project;
  const pts = snapPoints(project, [clipId], playheadMs);
  const snapped = snapMs(ms, pts);
  let next = { ...clip };
  if (edge === "in") {
    const delta = snapped - clip.startMs;
    const newIn = clip.inMs + delta * clipSpeed(clip);
    if (clip.outMs - newIn < 80 * clipSpeed(clip)) return project;
    next = {
      ...clip,
      startMs: Math.max(0, snapped),
      inMs: Math.max(0, newIn),
      keys: shiftKeys(clip.keys, -delta, clipDuration(clip) - delta),
      volKeys: shiftVolKeys(clip.volKeys, -delta, clipDuration(clip) - delta),
      speedKeys: shiftSpeedKeys(clip.speedKeys, -delta, clipDuration(clip) - delta),
    };
  } else {
    const newOut = clip.inMs + (snapped - clip.startMs) * clipSpeed(clip);
    if (newOut - clip.inMs < 80 * clipSpeed(clip)) return project;
    next = {
      ...clip,
      outMs: newOut,
      keys: shiftKeys(clip.keys, 0, snapped - clip.startMs),
      volKeys: shiftVolKeys(clip.volKeys, 0, snapped - clip.startMs),
      speedKeys: shiftSpeedKeys(clip.speedKeys, 0, snapped - clip.startMs),
    };
  }
  let clips = project.clips.map((c) => (c.id === clipId ? next : c));
  if (clip.linkedClipId) {
    const linked = clips.find((c) => c.id === clip.linkedClipId);
    if (linked) {
      const twin = edge === "in"
        ? { ...linked, startMs: next.startMs, inMs: next.inMs, keys: next.keys, volKeys: next.volKeys, speedKeys: next.speedKeys }
        : { ...linked, outMs: next.outMs, keys: next.keys, volKeys: next.volKeys, speedKeys: next.speedKeys };
      clips = clips.map((c) => (c.id === linked.id ? twin : c));
    }
  }
  return { ...project, clips };
}

export function unlinkClip(project: Project, clipId: string): Project {
  const clip = project.clips.find((c) => c.id === clipId);
  if (!clip?.linkedClipId) return project;
  return {
    ...project,
    clips: project.clips.map((c) =>
      c.id === clipId || c.id === clip.linkedClipId ? { ...c, linkedClipId: undefined } : c,
    ),
  };
}

export function placeMedia(project: Project, mediaId: string, trackId: string, startMs: number): Project {
  const media = project.media.find((m) => m.id === mediaId);
  const track = project.tracks.find((t) => t.id === trackId);
  if (!media || !track) return project;
  const clip = defaultClip(trackId, startMs, media.durationMs, { mediaId });
  return { ...project, clips: [...project.clips, clip] };
}

export function placeVideoWithAudio(project: Project, mediaId: string, startMs: number): Project {
  const media = project.media.find((m) => m.id === mediaId);
  const vTrack = project.tracks.find((t) => t.kind === "videoMain");
  const aTrack = project.tracks.find((t) => t.kind === "audioLinked");
  if (!media || !vTrack || !aTrack) return project;
  const start = startMs < 0 ? nextGapStart(project, vTrack.id) : startMs;
  const v = defaultClip(vTrack.id, start, media.durationMs, { mediaId });
  const a = defaultClip(aTrack.id, start, media.durationMs, { mediaId, linkedClipId: v.id });
  v.linkedClipId = a.id;
  return { ...project, clips: [...project.clips, v, a] };
}

export function patchClip(project: Project, clipId: string, patch: Partial<Clip>): Project {
  return { ...project, clips: project.clips.map((c) => (c.id === clipId ? { ...c, ...patch, id: c.id, trackId: c.trackId } : c)) };
}

export function toggleTrackMute(project: Project, trackId: string): Project {
  return { ...project, tracks: project.tracks.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t)) };
}

export function toggleTrackLock(project: Project, trackId: string): Project {
  return { ...project, tracks: project.tracks.map((t) => (t.id === trackId ? { ...t, locked: !t.locked } : t)) };
}

export function addTrack(project: Project, kind: TrackKind): Project {
  if (kind === "videoMain" || kind === "audioLinked") return project;
  const n = project.tracks.filter((t) => t.kind === kind).length + 1;
  return {
    ...project,
    tracks: [
      ...project.tracks,
      { id: uid("tr"), kind, name: n > 1 ? `${TRACK_LABEL[kind]} ${n}` : TRACK_LABEL[kind], muted: false, locked: false },
    ],
  };
}

export function canRemoveTrack(project: Project, trackId: string): boolean {
  const track = project.tracks.find((t) => t.id === trackId);
  if (!track || track.locked) return false;
  if (track.kind === "videoMain" || track.kind === "audioLinked") return false;
  return project.tracks.filter((t) => t.kind === track.kind).length > 1;
}

export function removeTrack(project: Project, trackId: string): Project {
  if (!canRemoveTrack(project, trackId)) return project;
  const ids = new Set(project.clips.filter((c) => c.trackId === trackId).map((c) => c.id));
  const clips = project.clips
    .filter((c) => !ids.has(c.id))
    .map((c) => (c.linkedClipId && ids.has(c.linkedClipId) ? { ...c, linkedClipId: undefined } : c));
  return { ...project, tracks: project.tracks.filter((t) => t.id !== trackId), clips };
}

export function setClipReverse(project: Project, clipId: string, reverse: boolean): Project {
  const clip = project.clips.find((c) => c.id === clipId);
  if (!clip) return project;
  return {
    ...project,
    clips: project.clips.map((c) => {
      if (c.id === clipId || (clip.linkedClipId && c.id === clip.linkedClipId)) return { ...c, reverse };
      return c;
    }),
  };
}

export function setClipSpeed(project: Project, clipId: string, speed: number): Project {
  const clip = project.clips.find((c) => c.id === clipId);
  if (!clip) return project;
  const clamped = Math.min(2, Math.max(0.5, speed));
  const oldDur = Math.max(1, clipDuration(clip));
  const apply = (c: Clip): Clip => {
    const next = { ...c, speed: clamped };
    const factor = clipDuration(next) / oldDur;
    const dur = clipDuration(next);
    return {
      ...next,
      keys: scaleKeys(c.keys, factor, dur),
      volKeys: scaleVolKeys(c.volKeys, factor, dur),
      speedKeys: scaleSpeedKeys(c.speedKeys, factor, dur),
    };
  };
  return {
    ...project,
    clips: project.clips.map((c) => {
      if (c.id === clipId) return apply(c);
      if (clip.linkedClipId && c.id === clip.linkedClipId) return apply(c);
      return c;
    }),
  };
}

export function duplicateClip(project: Project, clipId: string): Project {
  const clip = project.clips.find((c) => c.id === clipId);
  if (!clip) return project;
  const start = clipEnd(clip);
  const copy: Clip = {
    ...clip,
    id: uid("cl"),
    startMs: start,
    linkedClipId: undefined,
    keys: (clip.keys ?? []).map((k) => ({ ...k, transform: { ...k.transform } })),
    volKeys: (clip.volKeys ?? []).map((k) => ({ ...k })),
  };
  const clips = [...project.clips, copy];
  const linked = clip.linkedClipId ? project.clips.find((c) => c.id === clip.linkedClipId) : undefined;
  if (!linked) return { ...project, clips };
  const audio: Clip = {
    ...linked,
    id: uid("cl"),
    startMs: start,
    linkedClipId: copy.id,
    keys: (linked.keys ?? []).map((k) => ({ ...k, transform: { ...k.transform } })),
    volKeys: (linked.volKeys ?? []).map((k) => ({ ...k })),
  };
  copy.linkedClipId = audio.id;
  return { ...project, clips: [...clips, audio] };
}

export function patchTransform(project: Project, clipId: string, timelineMs: number, patch: Partial<Transform>, forceKey = false): Project {
  return {
    ...project,
    clips: project.clips.map((c) => (c.id === clipId ? writeTransform(c, timelineMs, patch, forceKey) : c)),
  };
}

export function deleteTransformKey(project: Project, clipId: string, tMs: number): Project {
  return { ...project, clips: project.clips.map((c) => (c.id === clipId ? removeKeyAt(c, tMs) : c)) };
}

export function patchVolume(project: Project, clipId: string, timelineMs: number, volume: number, forceKey = false): Project {
  return {
    ...project,
    clips: project.clips.map((c) => (c.id === clipId ? writeVolume(c, timelineMs, volume, forceKey) : c)),
  };
}

export function deleteVolumeKey(project: Project, clipId: string, tMs: number): Project {
  return { ...project, clips: project.clips.map((c) => (c.id === clipId ? removeVolKeyAt(c, tMs) : c)) };
}

export function placeAdjust(project: Project, startMs: number, durationMs = 5000): Project {
  const track = project.tracks.find((t) => t.kind === "adjust");
  if (!track) return project;
  const clip = defaultClip(track.id, startMs, durationMs, { text: "调节", look: "none" });
  return { ...project, clips: [...project.clips, clip] };
}

export function splitAllAt(project: Project, atMs: number): Project {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const clip of project.clips) {
    if (seen.has(clip.id)) continue;
    if (atMs <= clip.startMs || atMs >= clipEnd(clip)) continue;
    seen.add(clip.id);
    if (clip.linkedClipId) seen.add(clip.linkedClipId);
    ids.push(clip.id);
  }
  let next = project;
  for (const id of ids) next = splitClip(next, id, atMs);
  return next;
}

export function addMarker(project: Project, ms: number): Project {
  const markers = [...(project.markers ?? [])];
  const at = Math.max(0, Math.round(ms));
  if (markers.some((m) => Math.abs(m.ms - at) <= 40)) return project;
  markers.push({ id: uid("mk"), ms: at, label: `M${markers.length + 1}` });
  markers.sort((a, b) => a.ms - b.ms);
  return { ...project, markers };
}

export function removeMarker(project: Project, markerId: string): Project {
  return { ...project, markers: (project.markers ?? []).filter((m) => m.id !== markerId) };
}

export function setWorkIn(project: Project, ms: number): Project {
  const at = Math.max(0, Math.round(ms));
  let out = project.workOutMs;
  if (typeof out === "number" && out <= at) out = at + 1000;
  return { ...project, workInMs: at, workOutMs: out };
}

export function setWorkOut(project: Project, ms: number): Project {
  const at = Math.max(0, Math.round(ms));
  let inn = project.workInMs;
  if (typeof inn === "number" && inn >= at) inn = Math.max(0, at - 1000);
  return { ...project, workInMs: inn, workOutMs: at };
}

export function clearWork(project: Project): Project {
  return { ...project, workInMs: null, workOutMs: null };
}

function cloneClip(clip: Clip, id: string, startMs: number): Clip {
  return {
    ...clip,
    id,
    startMs,
    keys: (clip.keys ?? []).map((k) => ({ ...k, transform: { ...k.transform } })),
    volKeys: (clip.volKeys ?? []).map((k) => ({ ...k })),
    transform: { ...clip.transform },
    grade: { ...clip.grade },
    textStyle: clip.textStyle ? { ...clip.textStyle } : clip.textStyle,
  };
}

export function snapshotClips(project: Project, clipId: string): Clip[] {
  const clip = project.clips.find((c) => c.id === clipId);
  if (!clip) return [];
  const linked = clip.linkedClipId ? project.clips.find((c) => c.id === clip.linkedClipId) : undefined;
  return linked ? [clip, linked] : [clip];
}

export function pasteClips(project: Project, clips: Clip[], atMs: number): { project: Project; primaryId: string | null } {
  if (!clips.length) return { project, primaryId: null };
  const origin = Math.min(...clips.map((c) => c.startMs));
  const idMap = new Map<string, string>();
  const copies = clips.map((c) => {
    const id = uid("cl");
    idMap.set(c.id, id);
    return cloneClip(c, id, Math.max(0, atMs + (c.startMs - origin)));
  });
  for (const c of copies) {
    c.linkedClipId = c.linkedClipId ? idMap.get(c.linkedClipId) : undefined;
  }
  return { project: { ...project, clips: [...project.clips, ...copies] }, primaryId: copies[0]?.id ?? null };
}

export function mediaFitsTrack(kind: "video" | "audio" | "image", trackKind: TrackKind): boolean {
  if (kind === "video") return trackKind === "videoMain" || trackKind === "videoOverlay";
  if (kind === "image") return trackKind === "videoMain" || trackKind === "videoOverlay";
  return AUDIO_KINDS.includes(trackKind);
}

export function replaceClipMedia(project: Project, clipId: string, mediaId: string): Project {
  const clip = project.clips.find((c) => c.id === clipId);
  const media = project.media.find((m) => m.id === mediaId);
  const track = project.tracks.find((t) => t.id === clip?.trackId);
  if (!clip || !media || !track || !mediaFitsTrack(media.kind, track.kind)) return project;
  const apply = (c: Clip): Clip => {
    const dur = clipDuration(c);
    const inMs = Math.min(c.inMs, Math.max(0, media.durationMs - 80));
    let outMs = inMs + dur * clipSpeed(c);
    if (!c.loop) outMs = Math.min(outMs, media.durationMs);
    if (outMs - inMs < 80) outMs = Math.min(media.durationMs, inMs + 80 * clipSpeed(c));
    return { ...c, mediaId, inMs, outMs };
  };
  return {
    ...project,
    clips: project.clips.map((c) => {
      if (c.id === clipId) return apply(c);
      if (clip.linkedClipId && c.id === clip.linkedClipId) return apply(c);
      return c;
    }),
  };
}

export function nudgeClip(project: Project, clipId: string, deltaMs: number): Project {
  const clip = project.clips.find((c) => c.id === clipId);
  if (!clip) return project;
  return moveClip(project, clipId, clip.trackId, Math.max(0, clip.startMs + deltaMs), -1e9);
}

export function patchSpeedKey(project: Project, clipId: string, timelineMs: number, speed: number): Project {
  return { ...project, clips: project.clips.map((c) => (c.id === clipId ? writeSpeedKey(c, timelineMs, speed) : c)) };
}

export function deleteSpeedKey(project: Project, clipId: string, tMs: number): Project {
  return { ...project, clips: project.clips.map((c) => (c.id === clipId ? removeSpeedKeyAt(c, tMs) : c)) };
}

export function nestFromRange(project: Project, from: number, to: number): Project {
  if (to - from < 80) return project;
  const hit = project.clips.filter((c) => clipEnd(c) > from && c.startMs < to);
  if (!hit.length) return project;
  const nestId = uid("ns");
  const nest = {
    id: nestId,
    name: `嵌套 ${(project.nests?.length ?? 0) + 1}`,
    tracks: project.tracks.map((t) => ({ ...t })),
    clips: hit.map((c) => ({
      ...c,
      startMs: c.startMs - from,
      keys: (c.keys ?? []).map((k) => ({ ...k, transform: { ...k.transform } })),
      volKeys: (c.volKeys ?? []).map((k) => ({ ...k })),
      speedKeys: (c.speedKeys ?? []).map((k) => ({ ...k })),
    })),
  };
  const host = project.tracks.find((t) => t.kind === "videoMain") ?? project.tracks[0];
  if (!host) return project;
  const wrap = defaultClip(host.id, from, to - from, { nestId, text: nest.name });
  const ids = new Set(hit.map((c) => c.id));
  return {
    ...project,
    clips: project.clips.filter((c) => !ids.has(c.id)).concat(wrap),
    nests: [...(project.nests ?? []), nest],
  };
}

export function nestAsProject(root: Project, nestId: string): Project | null {
  const nest = (root.nests ?? []).find((n) => n.id === nestId);
  if (!nest) return null;
  return { ...root, clips: nest.clips, tracks: nest.tracks };
}
