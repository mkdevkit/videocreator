import type { Clip, Multicam } from "../types";

export function sampleMulticamMedia(clip: Clip, timelineMs: number): string | undefined {
  const mc = clip.multicam;
  if (!mc?.angles.length) return clip.mediaId;
  const local = Math.max(0, timelineMs - clip.startMs);
  const cuts = [...mc.cuts].sort((a, b) => a.tMs - b.tMs);
  let idx = cuts[0]?.angle ?? 0;
  for (const cut of cuts) {
    if (local >= cut.tMs) idx = cut.angle;
  }
  return mc.angles[idx]?.mediaId ?? clip.mediaId;
}

export function sampleMulticamAngle(clip: Clip, timelineMs: number): number {
  const mc = clip.multicam;
  if (!mc?.cuts.length) return 0;
  const local = Math.max(0, timelineMs - clip.startMs);
  const cuts = [...mc.cuts].sort((a, b) => a.tMs - b.tMs);
  let idx = cuts[0]?.angle ?? 0;
  for (const cut of cuts) {
    if (local >= cut.tMs) idx = cut.angle;
  }
  return idx;
}

export function cutMulticam(mc: Multicam, localMs: number, angle: number): Multicam {
  const tMs = Math.max(0, Math.round(localMs));
  const cuts = [...mc.cuts].filter((c) => Math.abs(c.tMs - tMs) > 40);
  cuts.push({ tMs, angle });
  return { ...mc, cuts: cuts.sort((a, b) => a.tMs - b.tMs) };
}

export function enableMulticam(clip: Clip, extra: { mediaId: string; label: string }[]): Clip {
  if (!clip.mediaId) return clip;
  const existing = clip.multicam?.angles ?? [{ mediaId: clip.mediaId, label: "A" }];
  const seen = new Set(existing.map((a) => a.mediaId));
  const added = extra.filter((a) => !seen.has(a.mediaId));
  if (!added.length && clip.multicam) return clip;
  const angles = [...existing, ...added];
  return {
    ...clip,
    multicam: {
      angles,
      cuts: clip.multicam?.cuts?.length ? clip.multicam.cuts : [{ tMs: 0, angle: 0 }],
    },
  };
}

export function splitMulticam(mc: Multicam | undefined, local: number): { left?: Multicam; right?: Multicam } {
  if (!mc) return {};
  const sorted = [...mc.cuts].sort((a, b) => a.tMs - b.tMs);
  let ang = 0;
  for (const c of sorted) if (c.tMs <= local) ang = c.angle;
  const leftCuts = sorted.filter((c) => c.tMs <= local);
  const rightCuts = sorted.filter((c) => c.tMs >= local).map((c) => ({ ...c, tMs: Math.max(0, c.tMs - local) }));
  if (!rightCuts.length || rightCuts[0].tMs > 0) rightCuts.unshift({ tMs: 0, angle: ang });
  return {
    left: { ...mc, cuts: leftCuts.length ? leftCuts : [{ tMs: 0, angle: ang }] },
    right: { ...mc, cuts: rightCuts },
  };
}
