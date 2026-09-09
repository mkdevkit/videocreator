import type { Project } from "../types";
import { getAudioEl } from "./media";
import { activeAudioClips } from "./compose";
import { clipDuration, clipSpeed, duckPresence, mediaTimeMs, sampleSpeed } from "./timeline";
import { nestAsProject } from "./ops";
import { envelopeGain } from "./keys";
import { applyGate, audioFxOf, insertToneChain } from "./audioFx";
import { sampleMulticamMedia } from "./multicam";

const playing = new Map<string, HTMLAudioElement>();
const previewSrc = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();
const previewTone = new Map<
  string,
  { hp: BiquadFilterNode; low: BiquadFilterNode; mid: BiquadFilterNode; high: BiquadFilterNode; gain: GainNode }
>();
let previewCtx: AudioContext | null = null;

function previewGraph(el: HTMLAudioElement, mediaId: string, fx: import("../types").AudioFx | undefined, volume: number) {
  try {
    if (!previewCtx) previewCtx = new AudioContext();
    const ctx = previewCtx;
    void ctx.resume();
    let src = previewSrc.get(el);
    if (!src) {
      src = ctx.createMediaElementSource(el);
      previewSrc.set(el, src);
    }
    let row = previewTone.get(mediaId);
    if (!row) {
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      const low = ctx.createBiquadFilter();
      low.type = "lowshelf";
      low.frequency.value = 220;
      const mid = ctx.createBiquadFilter();
      mid.type = "peaking";
      mid.frequency.value = 1100;
      mid.Q.value = 0.9;
      const high = ctx.createBiquadFilter();
      high.type = "highshelf";
      high.frequency.value = 4200;
      const gain = ctx.createGain();
      src.connect(hp).connect(low).connect(mid).connect(high).connect(gain).connect(ctx.destination);
      row = { hp, low, mid, high, gain };
      previewTone.set(mediaId, row);
    }
    const a = audioFxOf(fx);
    row.hp.frequency.value = 40 + a.denoise * 220;
    row.low.gain.value = a.low;
    row.mid.gain.value = a.mid;
    row.high.gain.value = a.high;
    row.gain.gain.value = Math.min(1, Math.max(0, volume));
    el.volume = 1;
  } catch {
    el.volume = Math.min(1, Math.max(0, volume));
  }
}

export function stopAllAudio() {
  for (const el of playing.values()) {
    el.pause();
  }
  playing.clear();
}

export function syncAudio(project: Project, ms: number, playingNow: boolean) {
  const active = playingNow ? activeAudioClips(project, ms) : [];
  const keep = new Set<string>();
  for (const { clip, gain } of active) {
    const mediaId = sampleMulticamMedia(clip, ms) ?? clip.mediaId;
    if (!mediaId || gain <= 0.001) continue;
    const el = getAudioEl(mediaId);
    if (!el) continue;
    keep.add(clip.id);
    const media = project.media.find((m) => m.id === mediaId);
    const mediaT = mediaTimeMs(clip, ms, media?.durationMs) / 1000;
    previewGraph(el, mediaId, clip.audioFx, gain);
    el.loop = Boolean(clip.loop) && !clip.reverse;
    if (clip.reverse) {
      el.pause();
      if (Math.abs(el.currentTime - mediaT) > 0.04) el.currentTime = mediaT;
      playing.set(clip.id, el);
      continue;
    }
    el.playbackRate = sampleSpeed(clip, ms);
    if (!playing.has(clip.id)) {
      el.currentTime = mediaT;
      void el.play().catch(() => undefined);
      playing.set(clip.id, el);
    } else if (Math.abs(el.currentTime - mediaT) > 0.25) {
      el.currentTime = mediaT;
    }
  }
  for (const [id, el] of playing) {
    if (!keep.has(id)) {
      el.pause();
      playing.delete(id);
    }
  }
}

export async function decodeClipBuffer(ctx: BaseAudioContext, mediaId: string): Promise<AudioBuffer | null> {
  const el = getAudioEl(mediaId);
  if (!el?.src) return null;
  const res = await fetch(el.src);
  const raw = await res.arrayBuffer();
  return ctx.decodeAudioData(raw.slice(0));
}

function sliceBuffer(ctx: BaseAudioContext, buf: AudioBuffer, startS: number, durS: number, reverse: boolean): AudioBuffer {
  const sr = buf.sampleRate;
  const start = Math.max(0, Math.floor(startS * sr));
  const len = Math.max(1, Math.floor(durS * sr));
  const out = ctx.createBuffer(buf.numberOfChannels, len, sr);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c);
    const dst = out.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const idx = reverse ? Math.min(src.length - 1, start + len - 1 - i) : Math.min(src.length - 1, start + i);
      dst[i] = src[idx] ?? 0;
    }
  }
  return out;
}

function scheduleEnvelope(gain: GainNode, clip: import("../types").Clip, start: number, dur: number, fromS = 0, spanS = Infinity) {
  const step = 0.04;
  let t = start;
  let last = -1;
  while (t <= start + dur + 0.001) {
    const ctxT = t - fromS;
    if (ctxT >= 0 && ctxT <= spanS) {
      const g = Math.max(0.0001, envelopeGain(clip, t * 1000));
      if (last < 0) gain.gain.setValueAtTime(g, ctxT);
      else if (Math.abs(g - last) > 0.015) gain.gain.linearRampToValueAtTime(g, ctxT);
      last = g;
    }
    t += step;
  }
}

function scheduleDuck(gain: GainNode, project: Project, clip: import("../types").Clip, start: number, dur: number, fromS = 0, spanS = Infinity) {
  const track = project.tracks.find((t) => t.id === clip.trackId);
  if (track?.kind !== "music" || clip.duck === false) {
    gain.gain.setValueAtTime(1, 0);
    return;
  }
  const to = Number.isFinite(clip.duckTo) ? clip.duckTo : 0.22;
  const end = start + dur;
  let t = start;
  let last = -1;
  while (t <= end + 0.001) {
    const ctxT = t - fromS;
    if (ctxT >= 0 && ctxT <= spanS) {
      const g = 1 - duckPresence(project, t * 1000) * (1 - to);
      if (last < 0) gain.gain.setValueAtTime(g, ctxT);
      else if (Math.abs(g - last) > 0.02) gain.gain.linearRampToValueAtTime(g, ctxT);
      last = g;
    }
    t += 0.05;
  }
}

async function scheduleProject(
  ctx: OfflineAudioContext,
  project: Project,
  fromS: number,
  durationS: number,
  cache: Map<string, AudioBuffer>,
  shiftMs = 0,
  depth = 0,
) {
  const kinds = ["audioLinked", "voice", "music", "sfx"] as const;
  for (const clip of project.clips) {
    if (clip.nestId && depth < 3) {
      const inner = nestAsProject(project, clip.nestId);
      if (inner) await scheduleProject(ctx, inner, fromS, durationS, cache, shiftMs + clip.startMs, depth + 1);
      continue;
    }
    const track = project.tracks.find((t) => t.id === clip.trackId);
    if (!track || track.muted || !kinds.includes(track.kind as (typeof kinds)[number]) || !clip.mediaId) continue;
    let buf = cache.get(clip.mediaId);
    if (!buf) {
      buf = (await decodeClipBuffer(ctx, clip.mediaId)) ?? undefined;
      if (buf) cache.set(clip.mediaId, buf);
    }
    if (!buf) continue;
    const start = (clip.startMs + shiftMs) / 1000;
    const dur = clipDuration(clip) / 1000;
    const ctxStart = start - fromS;
    if (ctxStart + dur <= 0 || ctxStart >= durationS) continue;
    const inS = clip.inMs / 1000;
    const media = project.media.find((m) => m.id === clip.mediaId);
    const cycle = Math.max(0.02, ((media?.durationMs ?? buf.duration * 1000) - clip.inMs) / 1000);
    const spanS = (clip.outMs - clip.inMs) / 1000;
    const sliced0 = sliceBuffer(ctx, buf, inS, clip.loop ? cycle : spanS, Boolean(clip.reverse));
    const sliced = applyGate(sliced0, clip.audioFx?.denoise ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = sliced;
    if ((clip.speedKeys ?? []).length) {
      let t = start;
      while (t <= start + dur + 0.001) {
        const ctxT = t - fromS;
        if (ctxT >= 0 && ctxT <= durationS) src.playbackRate.linearRampToValueAtTime(sampleSpeed(clip, (t - shiftMs / 1000) * 1000), Math.max(0, ctxT));
        t += 0.08;
      }
    } else {
      src.playbackRate.value = clipSpeed(clip);
    }
    if (clip.loop) {
      src.loop = true;
      src.loopStart = 0;
      src.loopEnd = sliced.duration;
    }
    const fade = ctx.createGain();
    const duck = ctx.createGain();
    const localStart = clip.startMs / 1000;
    scheduleEnvelope(fade, clip, localStart, dur, fromS - shiftMs / 1000, durationS);
    scheduleDuck(duck, project, clip, localStart, dur, fromS - shiftMs / 1000, durationS);
    const tone = insertToneChain(ctx, clip.audioFx);
    src.connect(fade).connect(duck).connect(tone.input);
    tone.output.connect(ctx.destination);
    const playAt = Math.max(0, ctxStart);
    const skip = Math.max(0, -ctxStart);
    const stopAt = Math.min(durationS, ctxStart + dur);
    if (clip.loop) {
      src.start(playAt, skip);
      src.stop(stopAt);
    } else {
      src.start(playAt, skip, sliced.duration);
      if (stopAt > playAt) src.stop(stopAt);
    }
  }
}

export function mixOffline(project: Project, durationS: number, sampleRate = 48000, fromS = 0): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(durationS * sampleRate)), sampleRate);
  return (async () => {
    await scheduleProject(ctx, project, fromS, durationS, new Map());
    return ctx.startRendering();
  })();
}
