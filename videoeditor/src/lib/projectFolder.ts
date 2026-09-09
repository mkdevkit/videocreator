import { saveAs } from "file-saver";
import type { Project } from "../types";
import { isTauri } from "./platform";
import { getBlob, storeBlob } from "./media";
import { persistBlob } from "./mediaStore";
import { emptyProject } from "./timeline";
import { DEFAULT_AUDIO_FX, DEFAULT_CHROMA, DEFAULT_EXPORT, DEFAULT_FX, DEFAULT_GRADE, DEFAULT_TEXT_STYLE, DEFAULT_TRANSFORM, TRACK_LABEL, TRACK_ORDER, type Clip, type CustomLook, type Nest, type Track } from "../types";
import { normalizeLook } from "./lookPack";
import { uid } from "./ids";

const FILE_NAME = "project.json";

function normalizeClip(c: Clip): Clip {
  return {
    ...c,
    volume: c.volume ?? 1,
    fadeInMs: c.fadeInMs ?? 0,
    fadeOutMs: c.fadeOutMs ?? 0,
    transform: { ...DEFAULT_TRANSFORM, ...c.transform },
    textStyle: c.textStyle ? { ...DEFAULT_TEXT_STYLE, ...c.textStyle } : c.textStyle,
    transition: c.transition ?? "cut",
    transitionMs: c.transitionMs ?? 400,
    speed: typeof c.speed === "number" && c.speed > 0 ? c.speed : 1,
    loop: Boolean(c.loop),
    reverse: Boolean(c.reverse),
    duck: c.duck !== false,
    duckTo: typeof c.duckTo === "number" ? c.duckTo : 0.22,
    grade: { ...DEFAULT_GRADE, ...c.grade },
    look: typeof c.look === "string" ? c.look : "none",
    vignette: typeof c.vignette === "number" ? c.vignette : 0,
    keys: Array.isArray(c.keys)
      ? c.keys.map((k) => ({ tMs: k.tMs, transform: { ...DEFAULT_TRANSFORM, ...k.transform } }))
      : [],
    volKeys: Array.isArray(c.volKeys)
      ? c.volKeys.map((k) => ({ tMs: k.tMs, volume: Number.isFinite(k.volume) ? k.volume : 1 }))
      : [],
    speedKeys: Array.isArray(c.speedKeys)
      ? c.speedKeys.map((k) => ({ tMs: k.tMs, speed: Number.isFinite(k.speed) ? k.speed : 1 }))
      : [],
    fx: { ...DEFAULT_FX, ...c.fx },
    chroma: { ...DEFAULT_CHROMA, ...c.chroma },
    nestId: c.nestId,
    stickerId: c.stickerId,
    audioFx: { ...DEFAULT_AUDIO_FX, ...c.audioFx },
    stabilize: typeof c.stabilize === "number" ? c.stabilize : 0,
    stab: c.stab && Array.isArray(c.stab.dx) ? { fps: c.stab.fps || 12, dx: c.stab.dx, dy: c.stab.dy ?? [] } : undefined,
    multicam: c.multicam,
  };
}

export function normalizeProject(raw: Partial<Project> | null | undefined): Project {
  const base = emptyProject(raw?.name || "未命名剪辑");
  const tracks: Track[] = Array.isArray(raw?.tracks) && raw.tracks.length ? raw.tracks : base.tracks;
  const seen = new Set(tracks.map((t) => t.kind));
  for (const kind of TRACK_ORDER) {
    if (!seen.has(kind)) {
      tracks.push({ id: uid("tr"), kind, name: TRACK_LABEL[kind], muted: false, locked: false });
    }
  }
  const clips: Clip[] = (raw?.clips ?? []).map(normalizeClip);
  const nests: Nest[] = Array.isArray(raw?.nests)
    ? raw.nests.map((n) => ({
        id: n.id || uid("ns"),
        name: n.name || "嵌套",
        tracks: Array.isArray(n.tracks) && n.tracks.length ? n.tracks : base.tracks,
        clips: (n.clips ?? []).map(normalizeClip),
      }))
    : [];
  return {
    name: raw?.name || base.name,
    aspect: raw?.aspect === "9:16" || raw?.aspect === "1:1" ? raw.aspect : "16:9",
    fps: raw?.fps === 25 || raw?.fps === 30 ? raw.fps : 24,
    media: raw?.media ?? [],
    tracks,
    clips,
    markers: Array.isArray(raw?.markers)
      ? raw.markers
          .filter((m) => m && Number.isFinite(m.ms))
          .map((m) => ({ id: m.id || uid("mk"), ms: Math.max(0, m.ms), label: m.label || "M" }))
          .sort((a, b) => a.ms - b.ms)
      : [],
    workInMs: typeof raw?.workInMs === "number" ? raw.workInMs : null,
    workOutMs: typeof raw?.workOutMs === "number" ? raw.workOutMs : null,
    nests,
    customLooks: Array.isArray(raw?.customLooks) ? (raw.customLooks as CustomLook[]).map(normalizeLook) : [],
    exportSettings: { ...DEFAULT_EXPORT, ...raw?.exportSettings },
  };
}

function pretty(data: unknown) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

export async function saveProjectJson(project: Project) {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { writeFile, mkdir, exists } = await import("@tauri-apps/plugin-fs");
    const dir = await open({ directory: true, title: "选择保存目录" });
    if (!dir || Array.isArray(dir)) return;
    const root = dir;
    if (!(await exists(root))) await mkdir(root, { recursive: true });
    const mediaDir = `${root}/media`;
    if (!(await exists(mediaDir))) await mkdir(mediaDir, { recursive: true });
    await writeFile(`${root}/${FILE_NAME}`, new TextEncoder().encode(pretty(project)));
    for (const item of project.media) {
      const blob = getBlob(item.id);
      if (!blob) continue;
      const buf = new Uint8Array(await blob.arrayBuffer());
      await writeFile(`${mediaDir}/${item.id}_${item.name}`, buf);
    }
    return;
  }
  if ("showDirectoryPicker" in window) {
    const dir = await (window as Window & { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
    const file = await dir.getFileHandle(FILE_NAME, { create: true });
    const w = await file.createWritable();
    await w.write(pretty(project));
    await w.close();
    const mediaDir = await dir.getDirectoryHandle("media", { create: true });
    for (const item of project.media) {
      const blob = getBlob(item.id);
      if (!blob) continue;
      const fh = await mediaDir.getFileHandle(`${item.id}_${item.name}`, { create: true });
      const mw = await fh.createWritable();
      await mw.write(blob);
      await mw.close();
    }
    return;
  }
  saveAs(new Blob([pretty(project)], { type: "application/json" }), FILE_NAME);
}

export async function openProjectJson(): Promise<Project | null> {
  if (isTauri()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readFile, readDir, readTextFile } = await import("@tauri-apps/plugin-fs");
    const picked = await open({ directory: true, title: "打开工程目录" });
    if (!picked || Array.isArray(picked)) return null;
    const text = await readTextFile(`${picked}/${FILE_NAME}`);
    const project = normalizeProject(JSON.parse(text) as Project);
    try {
      const files = await readDir(`${picked}/media`);
      for (const f of files) {
        if (!f.name || f.isDirectory) continue;
        const id = f.name.split("_")[0];
        const bytes = await readFile(`${picked}/media/${f.name}`);
        const blob = new Blob([bytes]);
        storeBlob(id, blob);
        await persistBlob(id, blob);
      }
    } catch {
      /* media optional */
    }
    return project;
  }
  if ("showDirectoryPicker" in window) {
    const dir = await (window as Window & { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
    const text = await (await (await dir.getFileHandle(FILE_NAME)).getFile()).text();
    const project = normalizeProject(JSON.parse(text) as Project);
    try {
      const mediaDir = await dir.getDirectoryHandle("media");
      const iter = (mediaDir as FileSystemDirectoryHandle & { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries();
      for await (const [name, handle] of iter) {
        if (handle.kind !== "file") continue;
        const file = await (handle as FileSystemFileHandle).getFile();
        const id = name.split("_")[0];
        storeBlob(id, file);
        await persistBlob(id, file);
      }
    } catch {
      /* media optional */
    }
    return project;
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve(normalizeProject(JSON.parse(await file.text()) as Project));
    };
    input.click();
  });
}
