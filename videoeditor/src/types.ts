export type AspectId = "16:9" | "9:16" | "1:1";

export const ASPECT_PX: Record<AspectId, { w: number; h: number }> = {
  "16:9": { w: 1920, h: 1080 },
  "9:16": { w: 1080, h: 1920 },
  "1:1": { w: 1080, h: 1080 },
};

export type TrackKind = "text" | "adjust" | "videoOverlay" | "videoMain" | "audioLinked" | "voice" | "music" | "sfx";

export type MediaKind = "video" | "audio" | "image";

export type TransitionKind = "cut" | "fade" | "dissolve";

export type StageFontId = "noto-sans" | "noto-serif";

export type ExportFormatId = "webm-vp9" | "webm-vp8" | "mp4-h264";

export type Mp4Encoder = "auto" | "browser" | "ffmpeg";

export interface Transform {
  x: number;
  y: number;
  scale: number;
  opacity: number;
  rotation: number;
}

export interface ColorGrade {
  brightness: number;
  contrast: number;
  saturate: number;
}

export interface ClipFx {
  blur: number;
  hue: number;
  sepia: number;
  grayscale: number;
}

export interface ChromaKey {
  enabled: boolean;
  color: string;
  similarity: number;
  smoothness: number;
}

export interface SpeedKey {
  tMs: number;
  speed: number;
}

export interface TransformKey {
  tMs: number;
  transform: Transform;
}

export interface VolumeKey {
  tMs: number;
  volume: number;
}

export const CLIP_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export type ClipSpeed = (typeof CLIP_SPEEDS)[number];

export interface TextStyle {
  fontId: StageFontId;
  fontSize: number;
  color: string;
  stroke: string;
  strokeWidth: number;
  align: "left" | "center" | "right";
  shadow: number;
  shadowColor: string;
  weight: 400 | 700;
  italic: boolean;
}

export interface MediaItem {
  id: string;
  kind: MediaKind;
  name: string;
  durationMs: number;
  width?: number;
  height?: number;
}

export interface Clip {
  id: string;
  trackId: string;
  mediaId?: string;
  startMs: number;
  inMs: number;
  outMs: number;
  volume: number;
  fadeInMs: number;
  fadeOutMs: number;
  transform: Transform;
  linkedClipId?: string;
  text?: string;
  textStyle?: TextStyle;
  transition?: TransitionKind;
  transitionMs: number;
  speed: number;
  loop: boolean;
  reverse: boolean;
  duck: boolean;
  duckTo: number;
  grade: ColorGrade;
  look: string;
  vignette: number;
  keys: TransformKey[];
  volKeys: VolumeKey[];
  speedKeys: SpeedKey[];
  fx: ClipFx;
  chroma: ChromaKey;
  nestId?: string;
  stickerId?: string;
  audioFx: AudioFx;
  stabilize: number;
  stab?: StabSeries;
  multicam?: Multicam;
}

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  muted: boolean;
  locked: boolean;
}

export interface Nest {
  id: string;
  name: string;
  tracks: Track[];
  clips: Clip[];
}

export interface ExportSettings {
  format: ExportFormatId;
  height: 1080 | 720 | 480;
  fps: 24 | 25 | 30;
  videoMbps: number;
  audioKbps: number;
  burnCaptions: boolean;
  exportSubtitles: boolean;
  mp4Encoder: Mp4Encoder;
}

export interface Marker {
  id: string;
  ms: number;
  label: string;
}

export interface Project {
  name: string;
  aspect: AspectId;
  fps: 24 | 25 | 30;
  media: MediaItem[];
  tracks: Track[];
  clips: Clip[];
  markers: Marker[];
  workInMs: number | null;
  workOutMs: number | null;
  nests: Nest[];
  customLooks: CustomLook[];
  exportSettings: ExportSettings;
}

export const TRACK_ORDER: TrackKind[] = ["text", "adjust", "videoOverlay", "videoMain", "audioLinked", "voice", "music", "sfx"];

export const TRACK_LABEL: Record<TrackKind, string> = {
  text: "文字",
  adjust: "调节",
  videoOverlay: "叠加",
  videoMain: "主视频",
  audioLinked: "原声",
  voice: "配音",
  music: "音乐",
  sfx: "音效",
};

export const DEFAULT_TRANSFORM: Transform = { x: 50, y: 50, scale: 1, opacity: 1, rotation: 0 };

export const DEFAULT_GRADE: ColorGrade = { brightness: 1, contrast: 1, saturate: 1 };

export const DEFAULT_FX: ClipFx = { blur: 0, hue: 0, sepia: 0, grayscale: 0 };

export const DEFAULT_CHROMA: ChromaKey = { enabled: false, color: "#00ff00", similarity: 0.28, smoothness: 0.12 };

export interface AudioFx {
  denoise: number;
  low: number;
  mid: number;
  high: number;
}

export interface StabSeries {
  fps: number;
  dx: number[];
  dy: number[];
}

export interface MulticamAngle {
  mediaId: string;
  label: string;
}

export interface MulticamCut {
  tMs: number;
  angle: number;
}

export interface Multicam {
  angles: MulticamAngle[];
  cuts: MulticamCut[];
}

export interface CustomLook {
  id: string;
  label: string;
  group: "调色" | "风格" | "镜头" | "社区";
  grade: ColorGrade;
  vignette: number;
  fx: ClipFx;
}

export const DEFAULT_AUDIO_FX: AudioFx = { denoise: 0, low: 0, mid: 0, high: 0 };

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontId: "noto-sans",
  fontSize: 4.2,
  color: "#f3eee3",
  stroke: "#000000",
  strokeWidth: 0.12,
  align: "center",
  shadow: 0,
  shadowColor: "#000000",
  weight: 400,
  italic: false,
};

export const DEFAULT_EXPORT: ExportSettings = {
  format: "webm-vp9",
  height: 1080,
  fps: 24,
  videoMbps: 6,
  audioKbps: 128,
  burnCaptions: false,
  exportSubtitles: false,
  mp4Encoder: "auto",
};
