import { ASPECT_PX, DEFAULT_EXPORT, type AspectId, type ExportFormatId, type ExportSettings, type Mp4Encoder } from "../types";

export const EXPORT_FORMATS: {
  id: ExportFormatId;
  label: string;
  hint: string;
  ext: "webm" | "mp4";
  mimes: string[];
}[] = [
  {
    id: "webm-vp9",
    label: "WebM · VP9",
    hint: "体积较小，Chrome / Edge 都能录",
    ext: "webm",
    mimes: ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp9"],
  },
  {
    id: "webm-vp8",
    label: "WebM · VP8",
    hint: "兼容更好，文件略大",
    ext: "webm",
    mimes: ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp8", "video/webm"],
  },
  {
    id: "mp4-h264",
    label: "MP4 · H.264",
    hint: "剪辑软件更认；可浏览器直录或本机 ffmpeg",
    ext: "mp4",
    mimes: [
      'video/mp4;codecs="avc1.640028,mp4a.40.2"',
      "video/mp4;codecs=avc1.640028,mp4a.40.2",
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4;codecs=avc1.4d0028,mp4a.40.2",
      "video/mp4;codecs=h264,aac",
      "video/mp4;codecs=avc1,mp4a.40.2",
      "video/mp4",
    ],
  },
];

export function exportPx(aspect: AspectId, height: number): { w: number; h: number } {
  const base = ASPECT_PX[aspect];
  const scale = height / base.h;
  const even = (n: number) => {
    const v = Math.max(2, Math.round(n));
    return v % 2 === 0 ? v : v - 1;
  };
  return { w: even(base.w * scale), h: even(height) };
}

export function exportSettingsOf(partial?: Partial<ExportSettings> | null): ExportSettings {
  const p = partial ?? {};
  const format: ExportFormatId =
    p.format === "webm-vp8" || p.format === "mp4-h264" || p.format === "webm-vp9" ? p.format : DEFAULT_EXPORT.format;
  const clamp = (n: unknown, min: number, max: number, fallback: number) => {
    const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
    return Math.min(max, Math.max(min, v));
  };
  return {
    format,
    height: p.height === 720 || p.height === 480 || p.height === 1080 ? p.height : DEFAULT_EXPORT.height,
    fps: p.fps === 24 || p.fps === 25 || p.fps === 30 ? p.fps : DEFAULT_EXPORT.fps,
    videoMbps: clamp(p.videoMbps, 1, 20, DEFAULT_EXPORT.videoMbps),
    audioKbps: clamp(p.audioKbps, 64, 256, DEFAULT_EXPORT.audioKbps),
    burnCaptions: typeof p.burnCaptions === "boolean" ? p.burnCaptions : DEFAULT_EXPORT.burnCaptions,
    exportSubtitles: typeof p.exportSubtitles === "boolean" ? p.exportSubtitles : DEFAULT_EXPORT.exportSubtitles,
    mp4Encoder: p.mp4Encoder === "browser" || p.mp4Encoder === "ffmpeg" || p.mp4Encoder === "auto" ? p.mp4Encoder : DEFAULT_EXPORT.mp4Encoder,
  };
}

export function browserMp4Mime(): string {
  return pickMimeFor("mp4-h264");
}

export function mp4EncoderOf(id?: Mp4Encoder | null): Mp4Encoder {
  return id === "browser" || id === "ffmpeg" ? id : "auto";
}

export function pickMimeFor(id: ExportFormatId): string {
  const spec = EXPORT_FORMATS.find((f) => f.id === id);
  if (!spec || typeof MediaRecorder === "undefined") return "";
  return spec.mimes.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function formatExt(id: ExportFormatId): "webm" | "mp4" {
  return EXPORT_FORMATS.find((f) => f.id === id)?.ext ?? "webm";
}
