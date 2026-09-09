import type { AudioFx } from "../types";
import { DEFAULT_AUDIO_FX } from "../types";

export function audioFxOf(fx?: AudioFx): AudioFx {
  return { ...DEFAULT_AUDIO_FX, ...fx };
}

export function audioFxActive(fx?: AudioFx): boolean {
  const a = audioFxOf(fx);
  return a.denoise > 0.02 || Math.abs(a.low) > 0.2 || Math.abs(a.mid) > 0.2 || Math.abs(a.high) > 0.2;
}

export function insertToneChain(ctx: BaseAudioContext, fx?: AudioFx): { input: AudioNode; output: AudioNode } {
  const a = audioFxOf(fx);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 40 + a.denoise * 220;
  hp.Q.value = 0.7;
  const low = ctx.createBiquadFilter();
  low.type = "lowshelf";
  low.frequency.value = 220;
  low.gain.value = a.low;
  const mid = ctx.createBiquadFilter();
  mid.type = "peaking";
  mid.frequency.value = 1100;
  mid.Q.value = 0.9;
  mid.gain.value = a.mid;
  const high = ctx.createBiquadFilter();
  high.type = "highshelf";
  high.frequency.value = 4200;
  high.gain.value = a.high;
  hp.connect(low).connect(mid).connect(high);
  return { input: hp, output: high };
}

export function applyGate(buf: AudioBuffer, amount: number): AudioBuffer {
  const a = Math.min(1, Math.max(0, amount));
  if (a < 0.02) return buf;
  const out = new AudioBuffer({
    length: buf.length,
    numberOfChannels: buf.numberOfChannels,
    sampleRate: buf.sampleRate,
  });
  const win = 512;
  const thresh = 0.018 + (1 - a) * 0.04;
  const floor = 1 - a * 0.85;
  for (const ch of Array.from({ length: buf.numberOfChannels }, (_, i) => i)) {
    const src = buf.getChannelData(ch);
    const dst = out.getChannelData(ch);
    for (let i = 0; i < src.length; i += win) {
      let rms = 0;
      const end = Math.min(src.length, i + win);
      for (let j = i; j < end; j++) rms += (src[j] ?? 0) ** 2;
      rms = Math.sqrt(rms / Math.max(1, end - i));
      const g = rms < thresh ? floor : 1;
      for (let j = i; j < end; j++) dst[j] = (src[j] ?? 0) * g;
    }
  }
  return out;
}
