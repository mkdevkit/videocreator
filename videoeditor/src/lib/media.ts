import type { MediaItem, MediaKind } from "../types";
import { uid } from "./ids";

const blobs = new Map<string, Blob>();
const urls = new Map<string, string>();
const videoEls = new Map<string, HTMLVideoElement>();
const imageEls = new Map<string, HTMLImageElement>();
const audioEls = new Map<string, HTMLAudioElement>();
const probeEls = new Map<string, HTMLVideoElement>();

export function mediaUrl(id: string): string | undefined {
  return urls.get(id);
}

export function storeBlob(id: string, blob: Blob) {
  blobs.set(id, blob);
  const prev = urls.get(id);
  if (prev) URL.revokeObjectURL(prev);
  urls.set(id, URL.createObjectURL(blob));
}

export function getBlob(id: string): Blob | undefined {
  return blobs.get(id);
}

function mediaKind(file: File): MediaKind | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";
  const n = file.name.toLowerCase();
  if (/\.(mp4|webm|mov|mkv)$/.test(n)) return "video";
  if (/\.(mp3|wav|m4a|ogg|aac)$/.test(n)) return "audio";
  if (/\.(png|jpe?g|webp|gif)$/.test(n)) return "image";
  return null;
}

function loadVideoMeta(url: string): Promise<{ durationMs: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () =>
      resolve({
        durationMs: Math.max(1, (v.duration || 0) * 1000),
        width: v.videoWidth || 1920,
        height: v.videoHeight || 1080,
      });
    v.onerror = () => reject(new Error("无法读取视频"));
    v.src = url;
  });
}

function loadAudioMeta(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.onloadedmetadata = () => resolve(Math.max(1, (a.duration || 0) * 1000));
    a.onerror = () => reject(new Error("无法读取音频"));
    a.src = url;
  });
}

function loadImageMeta(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("无法读取图片"));
    img.src = url;
  });
}

export async function importFile(file: File): Promise<MediaItem> {
  const kind = mediaKind(file);
  if (!kind) throw new Error(`不支持的文件：${file.name}`);
  const id = uid("md");
  storeBlob(id, file);
  const url = mediaUrl(id)!;
  let durationMs = 5000;
  let width: number | undefined;
  let height: number | undefined;
  if (kind === "video") {
    const m = await loadVideoMeta(url);
    durationMs = m.durationMs;
    width = m.width;
    height = m.height;
  } else if (kind === "audio") {
    durationMs = await loadAudioMeta(url);
  } else {
    const m = await loadImageMeta(url);
    width = m.width;
    height = m.height;
    durationMs = 5000;
  }
  return { id, kind, name: file.name, durationMs, width, height };
}

export function getVideoEl(id: string): HTMLVideoElement | null {
  const url = mediaUrl(id);
  if (!url) return null;
  let el = videoEls.get(id);
  if (!el) {
    el = document.createElement("video");
    el.preload = "auto";
    el.muted = true;
    el.playsInline = true;
    el.src = url;
    videoEls.set(id, el);
  }
  return el;
}

export function getImageEl(id: string): HTMLImageElement | null {
  const url = mediaUrl(id);
  if (!url) return null;
  let el = imageEls.get(id);
  if (!el) {
    el = new Image();
    el.src = url;
    imageEls.set(id, el);
  }
  return el;
}

export function getAudioEl(id: string): HTMLAudioElement | null {
  const url = mediaUrl(id);
  if (!url) return null;
  let el = audioEls.get(id);
  if (!el) {
    el = document.createElement("audio");
    el.preload = "auto";
    el.src = url;
    audioEls.set(id, el);
  }
  return el;
}

export function pauseAllVideos() {
  for (const el of videoEls.values()) el.pause();
}

export async function probeVideo(id: string, mediaTimeS: number): Promise<HTMLVideoElement | null> {
  const url = mediaUrl(id);
  if (!url) return null;
  let el = probeEls.get(id);
  if (!el) {
    el = document.createElement("video");
    el.preload = "auto";
    el.muted = true;
    el.playsInline = true;
    el.src = url;
    probeEls.set(id, el);
  }
  if (el.readyState < 2) {
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      el!.addEventListener("loadeddata", done, { once: true });
      el!.addEventListener("error", done, { once: true });
    });
  }
  if (Math.abs(el.currentTime - mediaTimeS) > 0.03) {
    el.currentTime = Math.max(0, mediaTimeS);
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      el!.addEventListener("seeked", done, { once: true });
      setTimeout(done, 90);
    });
  }
  return el;
}

export async function seekVideo(id: string, mediaTimeS: number): Promise<HTMLVideoElement | null> {
  const el = getVideoEl(id);
  if (!el) return null;
  if (el.readyState < 2) {
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      el.addEventListener("loadeddata", done, { once: true });
      el.addEventListener("error", done, { once: true });
    });
  }
  if (Math.abs(el.currentTime - mediaTimeS) > 0.04) {
    el.currentTime = Math.max(0, mediaTimeS);
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      el.addEventListener("seeked", done, { once: true });
      setTimeout(done, 80);
    });
  }
  return el;
}
