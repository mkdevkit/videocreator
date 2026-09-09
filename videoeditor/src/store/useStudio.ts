import { create } from "zustand";
import type { AspectId, Clip, ExportSettings, MediaItem, Project, TrackKind } from "../types";
import { DEFAULT_TRANSFORM } from "../types";
import { importFile } from "../lib/media";
import {
  addMarker,
  addTrack,
  clearWork,
  deleteClip,
  deleteSpeedKey,
  deleteTransformKey,
  deleteVolumeKey,
  duplicateClip,
  moveClip,
  nextGapStart,
  nudgeClip,
  nestFromRange,
  pasteClips,
  patchClip,
  patchSpeedKey,
  patchTransform,
  patchVolume,
  placeAdjust,
  placeMedia,
  placeVideoWithAudio,
  replaceClipMedia,
  removeMarker,
  removeTrack,
  setClipReverse,
  setClipSpeed,
  setWorkIn,
  setWorkOut,
  snapshotClips,
  splitAllAt,
  splitClip,
  toggleTrackLock,
  toggleTrackMute,
  trimClip,
  unlinkClip,
} from "../lib/ops";
import { restoreBlobs, persistBlob } from "../lib/mediaStore";
import { getBlob } from "../lib/media";
import { parseSrt } from "../lib/srt";
import { applyLook } from "../lib/looks";
import { defaultClip, emptyProject, projectDuration, textClip, workRange } from "../lib/timeline";
import { titlePreset } from "../lib/titles";
import { stickerOf } from "../lib/stickers";
import { loadLocalLooks, mergeLooks, normalizeLook, saveLocalLooks } from "../lib/lookPack";
import { cutMulticam, enableMulticam } from "../lib/multicam";
import { analyzeStabilize } from "../lib/stabilize";
import { trackPoint } from "../lib/track";
import { sampleTransform } from "../lib/keys";
import { normalizeProject } from "../lib/projectFolder";
import { prefetchPeaks } from "../lib/waveform";

const STORAGE_KEY = "videoeditor.autosave";
const HISTORY_LIMIT = 60;

function persist(project: Project) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    /* quota */
  }
}

function loadAutosave(): Project | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeProject(JSON.parse(raw) as Project);
  } catch {
    return null;
  }
}

export type ToolId = "select" | "cut";
export type DialogId = null | "export" | "help" | "filters" | "shop";

interface StudioState {
  project: Project;
  playheadMs: number;
  playing: boolean;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  selectedMediaId: string | null;
  selectedMarkerId: string | null;
  clipboard: Clip[];
  loopWork: boolean;
  editingNestId: string | null;
  pxPerMs: number;
  snap: boolean;
  ripple: boolean;
  tool: ToolId;
  dialog: DialogId;
  exporting: boolean;
  exportHint: string;
  past: Project[];
  future: Project[];
  ready: boolean;

  setPlayhead: (ms: number) => void;
  setPlaying: (playing: boolean) => void;
  setSelected: (clipId: string | null, trackId?: string | null) => void;
  setSelectedMedia: (mediaId: string | null) => void;
  setSelectedMarker: (markerId: string | null) => void;
  addMarkerAtPlayhead: () => void;
  jumpMarker: (dir: -1 | 1) => void;
  markIn: () => void;
  markOut: () => void;
  clearWorkArea: () => void;
  setLoopWork: (v: boolean) => void;
  copySelected: () => void;
  cutSelected: () => void;
  pasteClipboard: () => void;
  nudgeSelected: (deltaMs: number) => void;
  replaceSelectedMedia: () => void;
  nestWorkArea: () => void;
  enterNest: (nestId: string) => void;
  exitNest: () => void;
  applyStoreFilter: (id: string) => void;
  applyTitlePreset: (id: string) => void;
  placeSticker: (id: string) => void;
  importLookPack: (looks: import("../types").CustomLook[]) => void;
  addMulticamAngle: () => void;
  cutMulticamAt: (angle: number) => void;
  stabilizeSelected: () => Promise<void>;
  trackSelected: () => Promise<void>;
  speedKeySelected: (speed: number) => void;
  jobHint: string;
  setJobHint: (s: string) => void;
  setPxPerMs: (n: number) => void;
  setSnap: (v: boolean) => void;
  setRipple: (v: boolean) => void;
  setTool: (tool: ToolId) => void;
  setDialog: (dialog: DialogId) => void;
  setExporting: (v: boolean) => void;
  setExportHint: (s: string) => void;
  commit: () => void;
  undo: () => void;
  redo: () => void;
  mutate: (fn: (p: Project) => Project, history?: boolean) => void;
  newProject: () => void;
  replaceProject: (project: Project) => void;
  setName: (name: string) => void;
  setAspect: (aspect: AspectId) => void;
  patchExport: (patch: Partial<ExportSettings>) => void;
  importFiles: (files: FileList | File[]) => Promise<void>;
  addMediaToTimeline: (mediaId: string, trackId?: string, startMs?: number) => void;
  importSrt: (raw: string) => void;
  addTextAtPlayhead: () => void;
  addAdjustAtPlayhead: () => void;
  splitAtPlayhead: () => void;
  splitAllAtPlayhead: () => void;
  deleteSelected: (ripple?: boolean) => void;
  unlinkSelected: () => void;
  duplicateSelected: () => void;
  addTypedTrack: (kind: TrackKind) => void;
  boot: () => Promise<void>;
}

export function viewProject(root: Project, nestId: string | null): Project {
  if (!nestId) return root;
  const nest = (root.nests ?? []).find((n) => n.id === nestId);
  if (!nest) return root;
  return { ...root, clips: nest.clips, tracks: nest.tracks };
}

function commitView(root: Project, nestId: string | null, next: Project): Project {
  if (!nestId) return next;
  return {
    ...root,
    media: next.media,
    name: next.name,
    aspect: next.aspect,
    fps: next.fps,
    markers: next.markers,
    workInMs: next.workInMs,
    workOutMs: next.workOutMs,
    exportSettings: next.exportSettings,
    customLooks: next.customLooks ?? root.customLooks,
    nests: (next.nests ?? root.nests ?? []).map((n) => (n.id === nestId ? { ...n, clips: next.clips, tracks: next.tracks } : n)),
  };
}

export function useViewProject() {
  return useStudio((s) => viewProject(s.project, s.editingNestId));
}

function apply(get: () => StudioState, set: (p: Partial<StudioState>) => void, next: Project, history: boolean) {
  const cur = get().project;
  if (history) {
    set({
      project: next,
      past: [...get().past, structuredClone(cur)].slice(-HISTORY_LIMIT),
      future: [],
    });
  } else {
    set({ project: next });
  }
  persist(next);
}

export const useStudio = create<StudioState>((set, get) => ({
  project: emptyProject(),
  playheadMs: 0,
  playing: false,
  selectedClipId: null,
  selectedTrackId: null,
  selectedMediaId: null,
  selectedMarkerId: null,
  clipboard: [],
  loopWork: false,
  editingNestId: null,
  pxPerMs: 0.08,
  snap: true,
  ripple: false,
  tool: "select",
  dialog: null,
  exporting: false,
  exportHint: "",
  jobHint: "",
  past: [],
  future: [],
  ready: false,

  setPlayhead: (ms) => set({ playheadMs: Math.max(0, ms) }),
  setPlaying: (playing) => {
    if (playing) {
      const range = workRange(viewProject(get().project, get().editingNestId));
      if (range.active && get().playheadMs >= range.to - 20) set({ playheadMs: range.from, playing: true });
      else set({ playing: true });
      return;
    }
    set({ playing: false });
  },
  markIn: () => get().mutate((p) => setWorkIn(p, get().playheadMs)),
  markOut: () => get().mutate((p) => setWorkOut(p, get().playheadMs)),
  clearWorkArea: () => get().mutate((p) => clearWork(p)),
  setLoopWork: (v) => set({ loopWork: v }),
  copySelected: () => {
    const id = get().selectedClipId;
    if (!id) return;
    set({ clipboard: snapshotClips(viewProject(get().project, get().editingNestId), id).map((c) => ({ ...c })) });
  },
  cutSelected: () => {
    const id = get().selectedClipId;
    if (!id) return;
    set({ clipboard: snapshotClips(viewProject(get().project, get().editingNestId), id).map((c) => ({ ...c })) });
    get().deleteSelected(false);
  },
  pasteClipboard: () => {
    const clips = get().clipboard;
    if (!clips.length) return;
    let primary: string | null = null;
    get().mutate((p) => {
      const next = pasteClips(p, clips, get().playheadMs);
      primary = next.primaryId;
      return next.project;
    });
    if (primary) set({ selectedClipId: primary });
  },
  nudgeSelected: (deltaMs) => {
    const id = get().selectedClipId;
    if (!id) return;
    get().mutate((p) => nudgeClip(p, id, deltaMs));
  },
  replaceSelectedMedia: () => {
    const { selectedClipId, selectedMediaId } = get();
    if (!selectedClipId || !selectedMediaId) return;
    get().mutate((p) => replaceClipMedia(p, selectedClipId, selectedMediaId));
  },
  setSelected: (clipId, trackId) =>
    set({
      selectedClipId: clipId,
      selectedTrackId: trackId ?? get().selectedTrackId,
      selectedMarkerId: clipId ? null : get().selectedMarkerId,
    }),
  setSelectedMedia: (mediaId) => set({ selectedMediaId: mediaId }),
  setSelectedMarker: (markerId) => set({ selectedMarkerId: markerId, selectedClipId: markerId ? null : get().selectedClipId }),
  addMarkerAtPlayhead: () => get().mutate((p) => addMarker(p, get().playheadMs)),
  jumpMarker: (dir) => {
    const marks = [...(get().project.markers ?? [])].sort((a, b) => a.ms - b.ms);
    if (!marks.length) return;
    const now = get().playheadMs;
    const next =
      dir === 1
        ? marks.find((m) => m.ms > now + 20) ?? marks[0]
        : [...marks].reverse().find((m) => m.ms < now - 20) ?? marks[marks.length - 1];
    set({ playheadMs: next.ms, selectedMarkerId: next.id, selectedClipId: null });
  },
  setPxPerMs: (n) => set({ pxPerMs: Math.min(0.4, Math.max(0.02, n)) }),
  setSnap: (v) => set({ snap: v }),
  setRipple: (v) => set({ ripple: v }),
  setTool: (tool) => set({ tool }),
  setDialog: (dialog) => set({ dialog }),
  setExporting: (v) => set({ exporting: v }),
  setExportHint: (s) => set({ exportHint: s }),
  setJobHint: (s) => set({ jobHint: s }),

  commit: () => {
    const p = get().project;
    set({ past: [...get().past, structuredClone(p)].slice(-HISTORY_LIMIT), future: [] });
  },
  undo: () => {
    const past = get().past;
    if (!past.length) return;
    const prev = past[past.length - 1];
    const cur = get().project;
    set({ project: prev, past: past.slice(0, -1), future: [cur, ...get().future].slice(0, HISTORY_LIMIT), playing: false });
    persist(prev);
  },
  redo: () => {
    const future = get().future;
    if (!future.length) return;
    const next = future[0];
    const cur = get().project;
    set({ project: next, future: future.slice(1), past: [...get().past, cur].slice(-HISTORY_LIMIT), playing: false });
    persist(next);
  },
  mutate: (fn, history = true) => {
    const nestId = get().editingNestId;
    const root = get().project;
    apply(get, set, commitView(root, nestId, fn(viewProject(root, nestId))), history);
  },

  newProject: () => {
    const p = emptyProject();
    set({ project: p, playheadMs: 0, selectedClipId: null, selectedMediaId: null, selectedMarkerId: null, editingNestId: null, past: [], future: [], playing: false });
    persist(p);
  },
  replaceProject: (project) => {
    const p = normalizeProject(project);
    set({ project: p, playheadMs: 0, selectedClipId: null, selectedMediaId: null, selectedMarkerId: null, editingNestId: null, past: [], future: [], playing: false });
    persist(p);
  },
  setName: (name) => get().mutate((p) => ({ ...p, name }), false),
  setAspect: (aspect) => get().mutate((p) => ({ ...p, aspect })),
  patchExport: (patch) => get().mutate((p) => ({ ...p, exportSettings: { ...p.exportSettings, ...patch } }), false),

  importFiles: async (files) => {
    const list = [...files];
    const added: MediaItem[] = [];
    for (const file of list) {
      if (file.name.toLowerCase().endsWith(".srt") || file.type === "application/x-subrip") {
        get().importSrt(await file.text());
        continue;
      }
      try {
        added.push(await importFile(file));
        const blob = getBlob(added[added.length - 1].id);
        if (blob) await persistBlob(added[added.length - 1].id, blob);
      } catch (err) {
        console.warn(err);
      }
    }
    if (!added.length) return;
    get().mutate((p) => ({ ...p, media: [...p.media, ...added] }));
    prefetchPeaks(added.filter((m) => m.kind === "audio" || m.kind === "video").map((m) => m.id));
  },

  addMediaToTimeline: (mediaId, trackId, startMs) => {
    const { project, playheadMs } = get();
    const media = project.media.find((m) => m.id === mediaId);
    if (!media) return;
    const start = startMs ?? playheadMs;
    get().mutate((p) => {
      if (trackId) {
        const track = p.tracks.find((t) => t.id === trackId);
        if (!track) return p;
        if (media.kind === "video" && track.kind === "videoMain") return placeVideoWithAudio(p, mediaId, start);
        return placeMedia(p, mediaId, trackId, start);
      }
      if (media.kind === "video") return placeVideoWithAudio(p, mediaId, start < 0 ? -1 : start);
      const kind: TrackKind = media.kind === "image" ? "videoOverlay" : "voice";
      const track = p.tracks.find((t) => t.kind === kind);
      if (!track) return p;
      const at = start < 0 ? nextGapStart(p, track.id) : start;
      return placeMedia(p, mediaId, track.id, at);
    });
  },

  importSrt: (raw) => {
    const cues = parseSrt(raw);
    if (!cues.length) return;
    get().mutate((p) => {
      const track = p.tracks.find((t) => t.kind === "text");
      if (!track) return p;
      const clips = cues.map((c) => textClip(track.id, c.startMs, Math.max(200, c.endMs - c.startMs), c.text));
      return { ...p, clips: [...p.clips, ...clips] };
    });
  },

  addTextAtPlayhead: () => {
    const { playheadMs } = get();
    get().mutate((p) => {
      const track = p.tracks.find((t) => t.kind === "text");
      if (!track) return p;
      return { ...p, clips: [...p.clips, textClip(track.id, playheadMs, 2000, "字幕")] };
    });
  },

  addAdjustAtPlayhead: () => {
    const { playheadMs } = get();
    get().mutate((p) => placeAdjust(p, playheadMs));
    const p = get().project;
    const added = [...p.clips].reverse().find((c) => {
      const track = p.tracks.find((t) => t.id === c.trackId);
      return track?.kind === "adjust" && c.startMs === playheadMs;
    });
    if (added) set({ selectedClipId: added.id, selectedTrackId: added.trackId });
  },

  splitAtPlayhead: () => {
    const { selectedClipId, playheadMs, project } = get();
    const id =
      selectedClipId ??
      project.clips.find((c) => playheadMs > c.startMs && playheadMs < c.startMs + (c.outMs - c.inMs) / (c.speed || 1))?.id;
    if (!id) return;
    get().mutate((p) => splitClip(p, id, playheadMs));
  },

  splitAllAtPlayhead: () => {
    const { playheadMs } = get();
    get().mutate((p) => splitAllAt(p, playheadMs));
  },

  deleteSelected: (ripple) => {
    const { selectedClipId, selectedMarkerId } = get();
    if (selectedClipId) {
      const useRipple = ripple ?? get().ripple;
      get().mutate((p) => deleteClip(p, selectedClipId, useRipple));
      set({ selectedClipId: null });
      return;
    }
    if (selectedMarkerId) {
      get().mutate((p) => removeMarker(p, selectedMarkerId));
      set({ selectedMarkerId: null });
    }
  },

  unlinkSelected: () => {
    const id = get().selectedClipId;
    if (!id) return;
    get().mutate((p) => unlinkClip(p, id));
  },

  duplicateSelected: () => {
    const id = get().selectedClipId;
    if (!id) return;
    get().mutate((p) => duplicateClip(p, id));
  },

  addTypedTrack: (kind) => get().mutate((p) => addTrack(p, kind)),

  nestWorkArea: () => {
    const p = viewProject(get().project, get().editingNestId);
    const range = workRange(p);
    const from = range.active ? range.from : get().playheadMs;
    const to = range.active ? range.to : from + 5000;
    get().mutate((proj) => nestFromRange(proj, from, to));
  },
  enterNest: (nestId) => set({ editingNestId: nestId, playheadMs: 0, selectedClipId: null, playing: false }),
  exitNest: () => set({ editingNestId: null, playheadMs: 0, selectedClipId: null, playing: false }),
  applyStoreFilter: (id) => {
    const extras = [...(get().project.customLooks ?? []), ...loadLocalLooks()];
    const patch = applyLook(id, extras);
    const { selectedClipId } = get();
    if (selectedClipId) {
      get().mutate((p) => patchClip(p, selectedClipId, patch));
      return;
    }
    get().mutate((p) => {
      const next = placeAdjust(p, get().playheadMs);
      const added = next.clips[next.clips.length - 1];
      if (!added) return next;
      return patchClip(next, added.id, { ...patch, text: patch.look });
    });
  },
  applyTitlePreset: (id) => {
    const style = titlePreset(id).style;
    const sel = get().selectedClipId;
    if (sel) {
      get().mutate((p) => patchClip(p, sel, { textStyle: { ...style } }));
      return;
    }
    get().mutate((p) => {
      const track = p.tracks.find((t) => t.kind === "text");
      if (!track) return p;
      return { ...p, clips: [...p.clips, defaultClip(track.id, get().playheadMs, 2000, { text: "花字", textStyle: { ...style } })] };
    });
  },
  placeSticker: (id) => {
    get().mutate((p) => {
      const track = p.tracks.find((t) => t.kind === "text");
      if (!track) return p;
      const clip = defaultClip(track.id, get().playheadMs, 2500, {
        stickerId: id,
        text: stickerOf(id)?.label ?? "贴纸",
        transform: { ...DEFAULT_TRANSFORM, scale: 1, y: 38 },
      });
      return { ...p, clips: [...p.clips, clip] };
    });
  },
  importLookPack: (looks) => {
    const incoming = looks.map(normalizeLook);
    saveLocalLooks(mergeLooks(loadLocalLooks(), incoming));
    get().mutate((p) => ({ ...p, customLooks: mergeLooks(p.customLooks ?? [], incoming) }));
  },
  addMulticamAngle: () => {
    const { selectedClipId, selectedMediaId } = get();
    if (!selectedClipId || !selectedMediaId) return;
    const media = get().project.media.find((m) => m.id === selectedMediaId);
    if (!media || media.kind !== "video") return;
    get().mutate((p) => {
      const clip = p.clips.find((c) => c.id === selectedClipId);
      if (!clip) return p;
      const n = (clip.multicam?.angles.length ?? 1) + 1;
      return patchClip(p, clip.id, enableMulticam(clip, [{ mediaId: selectedMediaId, label: String.fromCharCode(64 + n) }]));
    });
  },
  cutMulticamAt: (angle) => {
    const id = get().selectedClipId;
    if (!id) return;
    get().mutate((p) => {
      const clip = p.clips.find((c) => c.id === id);
      if (!clip?.multicam) return p;
      const local = get().playheadMs - clip.startMs;
      return patchClip(p, id, { multicam: cutMulticam(clip.multicam, local, angle) });
    });
  },
  stabilizeSelected: async () => {
    const s = get();
    const view = viewProject(s.project, s.editingNestId);
    const clip = view.clips.find((c) => c.id === s.selectedClipId);
    if (!clip?.mediaId) return;
    const media = view.media.find((m) => m.id === clip.mediaId);
    if (!media || media.kind !== "video") return;
    set({ jobHint: "正在分析稳定…" });
    try {
      const stab = await analyzeStabilize(clip.mediaId, media.durationMs, (r) => set({ jobHint: `正在分析稳定 ${Math.round(r * 100)}%` }));
      get().mutate((p) => patchClip(p, clip.id, { stab, stabilize: clip.stabilize > 0.05 ? clip.stabilize : 0.7 }));
    } finally {
      set({ jobHint: "" });
    }
  },
  trackSelected: async () => {
    const s = get();
    const view = viewProject(s.project, s.editingNestId);
    const clip = view.clips.find((c) => c.id === s.selectedClipId);
    if (!clip?.mediaId) return;
    const pose = sampleTransform(clip, s.playheadMs);
    set({ jobHint: "正在跟踪…" });
    try {
      const keys = await trackPoint(clip, clip.mediaId, s.playheadMs, pose.x / 100, pose.y / 100, (r) =>
        set({ jobHint: `正在跟踪 ${Math.round(r * 100)}%` }),
      );
      if (keys.length) get().mutate((p) => patchClip(p, clip.id, { keys }));
    } finally {
      set({ jobHint: "" });
    }
  },
  speedKeySelected: (speed) => {
    const id = get().selectedClipId;
    if (!id) return;
    get().mutate((p) => patchSpeedKey(p, id, get().playheadMs, speed));
  },

  boot: async () => {
    await restoreBlobs();
    const saved = loadAutosave();
    if (saved) set({ project: saved, ready: true });
    else set({ ready: true });
    const media = get().project.media.filter((m) => m.kind === "audio" || m.kind === "video").map((m) => m.id);
    prefetchPeaks(media);
  },
}));

export function moveSelected(trackId: string, startMs: number) {
  const s = useStudio.getState();
  if (!s.selectedClipId) return;
  const playhead = s.snap ? s.playheadMs : -1e9;
  s.mutate((p) => moveClip(p, s.selectedClipId!, trackId, startMs, playhead), false);
}

export function trimSelected(edge: "in" | "out", ms: number) {
  const s = useStudio.getState();
  if (!s.selectedClipId) return;
  s.mutate((p) => trimClip(p, s.selectedClipId!, edge, ms, s.playheadMs), false);
}

export function patchSelected(patch: Partial<Clip>) {
  const s = useStudio.getState();
  if (!s.selectedClipId) return;
  s.mutate((p) => patchClip(p, s.selectedClipId!, patch), false);
}

export function poseSelected(patch: Partial<Clip["transform"]>, forceKey = false) {
  const s = useStudio.getState();
  if (!s.selectedClipId) return;
  s.mutate((p) => patchTransform(p, s.selectedClipId!, s.playheadMs, patch, forceKey), false);
}

export function speedSelected(speed: number) {
  const s = useStudio.getState();
  if (!s.selectedClipId) return;
  s.mutate((p) => setClipSpeed(p, s.selectedClipId!, speed));
}

export function reverseSelected(reverse: boolean) {
  const s = useStudio.getState();
  if (!s.selectedClipId) return;
  s.mutate((p) => setClipReverse(p, s.selectedClipId!, reverse));
}

export function dropKey(tMs: number) {
  const s = useStudio.getState();
  if (!s.selectedClipId) return;
  s.mutate((p) => deleteTransformKey(p, s.selectedClipId!, tMs));
}

export function volSelected(volume: number, forceKey = false) {
  const s = useStudio.getState();
  if (!s.selectedClipId) return;
  s.mutate((p) => patchVolume(p, s.selectedClipId!, s.playheadMs, volume, forceKey), false);
}

export function dropSpeedKey(tMs: number) {
  const s = useStudio.getState();
  if (!s.selectedClipId) return;
  s.mutate((p) => deleteSpeedKey(p, s.selectedClipId!, tMs));
}

export function dropVolKey(tMs: number) {
  const s = useStudio.getState();
  if (!s.selectedClipId) return;
  s.mutate((p) => deleteVolumeKey(p, s.selectedClipId!, tMs));
}

export function muteTrack(trackId: string) {
  useStudio.getState().mutate((p) => toggleTrackMute(p, trackId));
}

export function lockTrack(trackId: string) {
  useStudio.getState().mutate((p) => toggleTrackLock(p, trackId));
}

export function dropTrack(trackId: string) {
  const s = useStudio.getState();
  const selected = viewProject(s.project, s.editingNestId).clips.find((c) => c.id === s.selectedClipId);
  s.mutate((p) => removeTrack(p, trackId));
  if (selected?.trackId === trackId) s.setSelected(null);
}

export function durationOf(project: Project) {
  return Math.max(1000, projectDuration(project));
}
