import type { Clip, Transform, TransformKey, VolumeKey } from "../types";
import { DEFAULT_TRANSFORM } from "../types";
import { clipDuration } from "./timeline";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mix(a: Transform, b: Transform, t: number): Transform {
  const e = t * t * (3 - 2 * t);
  return {
    x: lerp(a.x, b.x, e),
    y: lerp(a.y, b.y, e),
    scale: lerp(a.scale, b.scale, e),
    opacity: lerp(a.opacity, b.opacity, e),
    rotation: lerp(a.rotation ?? 0, b.rotation ?? 0, e),
  };
}

export function sortedKeys(clip: Clip): TransformKey[] {
  return [...(clip.keys ?? [])].sort((a, b) => a.tMs - b.tMs);
}

export function sampleTransform(clip: Clip, timelineMs: number): Transform {
  const rest = { ...DEFAULT_TRANSFORM, ...clip.transform };
  const keys = sortedKeys(clip);
  if (!keys.length) return rest;
  const local = Math.max(0, Math.min(clipDuration(clip), timelineMs - clip.startMs));
  if (local <= keys[0].tMs) return { ...DEFAULT_TRANSFORM, ...keys[0].transform };
  const last = keys[keys.length - 1];
  if (local >= last.tMs) return { ...DEFAULT_TRANSFORM, ...last.transform };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (local >= a.tMs && local <= b.tMs) {
      const t = (local - a.tMs) / Math.max(1, b.tMs - a.tMs);
      return mix({ ...DEFAULT_TRANSFORM, ...a.transform }, { ...DEFAULT_TRANSFORM, ...b.transform }, t);
    }
  }
  return rest;
}

export function upsertKey(clip: Clip, timelineMs: number, transform: Transform): TransformKey[] {
  const local = Math.max(0, Math.round(timelineMs - clip.startMs));
  let keys = sortedKeys(clip);
  if (!keys.length) {
    keys = [{ tMs: 0, transform: { ...clip.transform } }];
  }
  const hit = keys.find((k) => Math.abs(k.tMs - local) <= 40);
  if (hit) return keys.map((k) => (k === hit ? { tMs: hit.tMs, transform: { ...transform } } : k));
  return [...keys, { tMs: local, transform: { ...transform } }].sort((a, b) => a.tMs - b.tMs);
}

export function writeTransform(clip: Clip, timelineMs: number, patch: Partial<Transform>, forceKey: boolean): Clip {
  const current = sampleTransform(clip, timelineMs);
  const next = { ...current, ...patch };
  const local = timelineMs - clip.startMs;
  const hasKeys = (clip.keys ?? []).length > 0;
  if (!forceKey && !hasKeys && local <= 40) {
    return { ...clip, transform: next };
  }
  return { ...clip, transform: next, keys: upsertKey({ ...clip, transform: clip.transform }, timelineMs, next) };
}

export function removeKeyAt(clip: Clip, tMs: number): Clip {
  const keys = sortedKeys(clip).filter((k) => Math.abs(k.tMs - tMs) > 40);
  return { ...clip, keys };
}

export function shiftKeys(keys: TransformKey[] | undefined, deltaMs: number, durMs: number): TransformKey[] {
  return (keys ?? [])
    .map((k) => ({ ...k, tMs: k.tMs + deltaMs }))
    .filter((k) => k.tMs >= 0 && k.tMs <= durMs + 1);
}

export function scaleKeys(keys: TransformKey[] | undefined, factor: number, durMs: number): TransformKey[] {
  return (keys ?? [])
    .map((k) => ({ ...k, tMs: Math.round(k.tMs * factor) }))
    .filter((k) => k.tMs >= 0 && k.tMs <= durMs + 1);
}

export function sortedVolKeys(clip: Clip): VolumeKey[] {
  return [...(clip.volKeys ?? [])].sort((a, b) => a.tMs - b.tMs);
}

export function sampleVolume(clip: Clip, timelineMs: number): number {
  const keys = sortedVolKeys(clip);
  const rest = Number.isFinite(clip.volume) ? clip.volume : 1;
  if (!keys.length) return rest;
  const local = Math.max(0, Math.min(clipDuration(clip), timelineMs - clip.startMs));
  if (local <= keys[0].tMs) return keys[0].volume;
  const last = keys[keys.length - 1];
  if (local >= last.tMs) return last.volume;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (local >= a.tMs && local <= b.tMs) {
      const t = (local - a.tMs) / Math.max(1, b.tMs - a.tMs);
      const e = t * t * (3 - 2 * t);
      return a.volume + (b.volume - a.volume) * e;
    }
  }
  return rest;
}

export function upsertVolKey(clip: Clip, timelineMs: number, volume: number): VolumeKey[] {
  const local = Math.max(0, Math.round(timelineMs - clip.startMs));
  let keys = sortedVolKeys(clip);
  if (!keys.length) keys = [{ tMs: 0, volume: clip.volume }];
  const hit = keys.find((k) => Math.abs(k.tMs - local) <= 40);
  if (hit) return keys.map((k) => (k === hit ? { tMs: hit.tMs, volume } : k));
  return [...keys, { tMs: local, volume }].sort((a, b) => a.tMs - b.tMs);
}

export function writeVolume(clip: Clip, timelineMs: number, volume: number, forceKey: boolean): Clip {
  const local = timelineMs - clip.startMs;
  const hasKeys = (clip.volKeys ?? []).length > 0;
  if (!forceKey && !hasKeys && local <= 40) {
    return { ...clip, volume };
  }
  return { ...clip, volume, volKeys: upsertVolKey(clip, timelineMs, volume) };
}

export function removeVolKeyAt(clip: Clip, tMs: number): Clip {
  return { ...clip, volKeys: sortedVolKeys(clip).filter((k) => Math.abs(k.tMs - tMs) > 40) };
}

export function shiftVolKeys(keys: VolumeKey[] | undefined, deltaMs: number, durMs: number): VolumeKey[] {
  return (keys ?? [])
    .map((k) => ({ ...k, tMs: k.tMs + deltaMs }))
    .filter((k) => k.tMs >= 0 && k.tMs <= durMs + 1);
}

export function scaleVolKeys(keys: VolumeKey[] | undefined, factor: number, durMs: number): VolumeKey[] {
  return (keys ?? [])
    .map((k) => ({ ...k, tMs: Math.round(k.tMs * factor) }))
    .filter((k) => k.tMs >= 0 && k.tMs <= durMs + 1);
}

export function shiftSpeedKeys(keys: import("../types").SpeedKey[] | undefined, deltaMs: number, durMs: number) {
  return (keys ?? [])
    .map((k) => ({ ...k, tMs: k.tMs + deltaMs }))
    .filter((k) => k.tMs >= 0 && k.tMs <= durMs + 1);
}

export function scaleSpeedKeys(keys: import("../types").SpeedKey[] | undefined, factor: number, durMs: number) {
  return (keys ?? [])
    .map((k) => ({ ...k, tMs: Math.round(k.tMs * factor) }))
    .filter((k) => k.tMs >= 0 && k.tMs <= durMs + 1);
}

export function writeSpeedKey(clip: Clip, timelineMs: number, speed: number): Clip {
  const local = Math.max(0, Math.round(timelineMs - clip.startMs));
  const keys = [...(clip.speedKeys ?? [])].sort((a, b) => a.tMs - b.tMs);
  const seeded = keys.length ? keys : [{ tMs: 0, speed: clip.speed || 1 }];
  const hit = seeded.find((k) => Math.abs(k.tMs - local) <= 40);
  const next = hit
    ? seeded.map((k) => (k === hit ? { tMs: hit.tMs, speed } : k))
    : [...seeded, { tMs: local, speed }].sort((a, b) => a.tMs - b.tMs);
  return { ...clip, speedKeys: next };
}

export function removeSpeedKeyAt(clip: Clip, tMs: number): Clip {
  return { ...clip, speedKeys: (clip.speedKeys ?? []).filter((k) => Math.abs(k.tMs - tMs) > 40) };
}

export function envelopeGain(clip: Clip, ms: number): number {
  const local = ms - clip.startMs;
  const dur = clipDuration(clip);
  let g = sampleVolume(clip, ms);
  if (clip.fadeInMs > 0 && local < clip.fadeInMs) g *= local / clip.fadeInMs;
  if (clip.fadeOutMs > 0 && local > dur - clip.fadeOutMs) g *= Math.max(0, (dur - local) / clip.fadeOutMs);
  return Math.min(1, Math.max(0, g));
}

export function hitTestClip(
  clip: Clip,
  timelineMs: number,
  nx: number,
  ny: number,
): boolean {
  const t = sampleTransform(clip, timelineMs);
  const rad = ((t.rotation ?? 0) * Math.PI) / 180;
  const dx = nx - t.x / 100;
  const dy = ny - t.y / 100;
  const lx = dx * Math.cos(-rad) - dy * Math.sin(-rad);
  const ly = dx * Math.sin(-rad) + dy * Math.cos(-rad);
  return Math.abs(lx) <= t.scale / 2 && Math.abs(ly) <= t.scale / 2;
}
