import { saveAs } from "file-saver";
import type { Project } from "../types";
import { mixOffline } from "./audio";
import { drawFrame } from "./compose";
import { browserMp4Mime, exportPx, exportSettingsOf, formatExt, pickMimeFor } from "./exportSettings";
import { ffmpegAvailable, transcodeToMp4 } from "./ffmpeg";
import { waitStageFonts } from "./fonts";
import { pauseAllVideos } from "./media";
import { isTauri } from "./platform";
import { toSrt } from "./srt";
import { clipDuration, projectDuration, workRange } from "./timeline";

function textCues(project: Project, fromMs: number, toMs: number) {
  return project.clips
    .filter((c) => {
      const track = project.tracks.find((t) => t.id === c.trackId);
      return track?.kind === "text" && c.text;
    })
    .sort((a, b) => a.startMs - b.startMs)
    .map((c) => ({ startMs: c.startMs, endMs: c.startMs + clipDuration(c), text: c.text ?? "" }))
    .filter((c) => c.endMs > fromMs && c.startMs < toMs)
    .map((c) => ({
      startMs: Math.max(0, c.startMs - fromMs),
      endMs: Math.min(toMs - fromMs, c.endMs - fromMs),
      text: c.text,
    }));
}

export async function recordProject(
  project: Project,
  onProgress?: (ratio: number) => void,
  useWorkArea = false,
): Promise<{ blob: Blob; ext: "webm" | "mp4"; srt?: string }> {
  const st = exportSettingsOf(project.exportSettings);
  const wantMp4 = st.format === "mp4-h264";
  const nativeMp4 = browserMp4Mime();
  let mime = "";
  let useFfmpeg = false;
  if (wantMp4) {
    if (st.mp4Encoder === "browser") {
      if (!nativeMp4) throw new Error("当前浏览器不能直录 MP4。请用较新的 Chrome / Edge，或改选 WebM / 本机 ffmpeg");
      mime = nativeMp4;
    } else if (st.mp4Encoder === "ffmpeg") {
      if (!isTauri() || !(await ffmpegAvailable())) throw new Error("本机 ffmpeg 不可用。Web 版请改选「浏览器直录」，或安装 ffmpeg 后用桌面端");
      mime = pickMimeFor("webm-vp9") || pickMimeFor("webm-vp8");
      useFfmpeg = true;
    } else if (nativeMp4) {
      mime = nativeMp4;
    } else if (isTauri() && (await ffmpegAvailable())) {
      mime = pickMimeFor("webm-vp9") || pickMimeFor("webm-vp8");
      useFfmpeg = true;
    } else {
      throw new Error("当前浏览器不能直录 MP4。请用 Chrome / Edge，或改选 WebM；桌面端也可装 ffmpeg 转码");
    }
  } else {
    mime = pickMimeFor(st.format) || pickMimeFor("webm-vp9") || pickMimeFor("webm-vp8");
  }
  if (!mime) throw new Error("当前浏览器不支持视频录制，请使用 Chrome 或 Edge");
  const ext = mime.includes("mp4") ? "mp4" : formatExt(st.format);
  const range = useWorkArea ? workRange(project) : { from: 0, to: projectDuration(project), active: false };
  const from = range.from;
  const duration = Math.max(0, range.to - range.from);
  if (duration <= 0) throw new Error("时间轴是空的");
  pauseAllVideos();
  await waitStageFonts();

  const { w, h } = exportPx(project.aspect, st.height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");

  const canvasStream = canvas.captureStream(st.fps);
  const audioCtx = new AudioContext();
  await audioCtx.resume();
  const dest = audioCtx.createMediaStreamDestination();
  const mixed = await mixOffline(project, duration / 1000, audioCtx.sampleRate, from / 1000);
  const src = audioCtx.createBufferSource();
  src.buffer = mixed;
  src.connect(dest);
  const tracks = [...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()];
  const rec = new MediaRecorder(new MediaStream(tracks), {
    mimeType: mime,
    videoBitsPerSecond: Math.round(st.videoMbps * 1_000_000),
    audioBitsPerSecond: Math.round(st.audioKbps * 1000),
  });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<Blob>((resolve, reject) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || (ext === "mp4" ? "video/mp4" : "video/webm") }));
    rec.onerror = () => reject(new Error("录制失败"));
  });

  rec.start(200);
  src.start();
  const frameMs = 1000 / st.fps;
  const t0 = performance.now();

  await new Promise<void>((resolve, reject) => {
    const tick = async () => {
      try {
        const elapsed = performance.now() - t0;
        if (elapsed >= duration) {
          await drawFrame(ctx, project, from + duration - 1, w, h, { precise: true, burnCaptions: st.burnCaptions });
          onProgress?.(1);
          resolve();
          return;
        }
        const ms = from + Math.min(duration - 1, elapsed);
        await drawFrame(ctx, project, ms, w, h, { precise: true, burnCaptions: st.burnCaptions });
        onProgress?.(ms / duration);
        const next = t0 + Math.floor(elapsed / frameMs + 1) * frameMs;
        window.setTimeout(() => void tick(), Math.max(0, next - performance.now()));
      } catch (err) {
        reject(err);
      }
    };
    void tick();
  });

  rec.stop();
  src.stop();
  void audioCtx.close();
  let outBlob = await stopped;
  let outExt: "webm" | "mp4" = ext;
  if (useFfmpeg || (wantMp4 && st.mp4Encoder === "auto" && !outBlob.type.includes("mp4") && isTauri() && (await ffmpegAvailable()))) {
    onProgress?.(1);
    outBlob = await transcodeToMp4(outBlob);
    outExt = "mp4";
  }
  const srt = st.exportSubtitles ? toSrt(textCues(project, from, from + duration)) : undefined;
  return { blob: outBlob, ext: outExt, srt };
}

export function downloadExport(name: string, blob: Blob, ext: "webm" | "mp4", srt?: string) {
  const base = name.replace(/[\\/:*?"<>|]+/g, "_") || "export";
  saveAs(blob, `${base}.${ext}`);
  if (srt) saveAs(new Blob([srt], { type: "text/plain;charset=utf-8" }), `${base}.srt`);
}
