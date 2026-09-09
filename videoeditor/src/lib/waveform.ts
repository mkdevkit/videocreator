import { getBlob } from "./media";

const peaksCache = new Map<string, Float32Array>();
const inflight = new Map<string, Promise<Float32Array | null>>();
let decodeCtx: AudioContext | null = null;

const BUCKETS = 2400;

function audioCtx(): AudioContext {
  if (!decodeCtx || decodeCtx.state === "closed") decodeCtx = new AudioContext();
  return decodeCtx;
}

function computePeaks(buf: AudioBuffer, buckets: number): Float32Array {
  const ch = buf.numberOfChannels;
  const len = buf.length;
  const out = new Float32Array(buckets);
  const step = Math.max(1, Math.floor(len / buckets));
  for (let i = 0; i < buckets; i++) {
    const start = i * step;
    const end = Math.min(len, start + step);
    let peak = 0;
    for (let c = 0; c < ch; c++) {
      const data = buf.getChannelData(c);
      for (let s = start; s < end; s++) {
        const v = Math.abs(data[s] ?? 0);
        if (v > peak) peak = v;
      }
    }
    out[i] = peak;
  }
  return out;
}

export function peaksOf(mediaId: string): Float32Array | null {
  return peaksCache.get(mediaId) ?? null;
}

export function ensurePeaks(mediaId: string): Promise<Float32Array | null> {
  const hit = peaksCache.get(mediaId);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(mediaId);
  if (pending) return pending;
  const work = (async () => {
    try {
      const blob = getBlob(mediaId);
      if (!blob) return null;
      const raw = await blob.arrayBuffer();
      const buf = await audioCtx().decodeAudioData(raw.slice(0));
      const peaks = computePeaks(buf, BUCKETS);
      peaksCache.set(mediaId, peaks);
      return peaks;
    } catch {
      return null;
    } finally {
      inflight.delete(mediaId);
    }
  })();
  inflight.set(mediaId, work);
  return work;
}

export function prefetchPeaks(mediaIds: string[]) {
  for (const id of mediaIds) void ensurePeaks(id);
}
