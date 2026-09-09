import { useEffect, useState } from "react";
import { downloadExport, recordProject } from "../lib/exportVideo";
import { EXPORT_FORMATS, browserMp4Mime, exportSettingsOf } from "../lib/exportSettings";
import type { Mp4Encoder } from "../types";
import { ffmpegAvailable } from "../lib/ffmpeg";
import { isTauri } from "../lib/platform";
import { formatMs, workRange } from "../lib/timeline";
import { useStudio } from "../store/useStudio";

export function ExportDialog() {
  const project = useStudio((s) => s.project);
  const exporting = useStudio((s) => s.exporting);
  const hint = useStudio((s) => s.exportHint);
  const st = exportSettingsOf(project.exportSettings);
  const [progress, setProgress] = useState(0);
  const [hasFf, setHasFf] = useState(false);
  const [browserMp4, setBrowserMp4] = useState("");
  const [onlyWork, setOnlyWork] = useState(true);
  const range = workRange(project);

  useEffect(() => {
    void ffmpegAvailable().then(setHasFf);
    setBrowserMp4(browserMp4Mime());
    if (!isTauri() && st.mp4Encoder === "ffmpeg") useStudio.getState().patchExport({ mp4Encoder: "auto" });
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !exporting && useStudio.getState().setDialog(null)}>
      <div className="w-full max-w-md rounded-lg border border-ink-600 bg-ink-800 p-4 shadow-paper" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 font-display text-base text-paper">导出</div>
        <div className="grid gap-2">
          <label className="text-[11px] text-ink-200">
            格式
            <select className="field mt-1" value={st.format} onChange={(e) => useStudio.getState().patchExport({ format: e.target.value as typeof st.format })}>
              {EXPORT_FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          {st.format === "mp4-h264" && (
            <label className="text-[11px] text-ink-200">
              MP4 编码
              <select
                className="field mt-1"
                value={st.mp4Encoder}
                onChange={(e) => useStudio.getState().patchExport({ mp4Encoder: e.target.value as Mp4Encoder })}
              >
                <option value="auto">自动：能直录就直录，否则桌面转 ffmpeg</option>
                <option value="browser">浏览器直录（Chrome / Edge MediaRecorder）</option>
                <option value="ffmpeg" disabled={!isTauri()}>
                  本机 ffmpeg 转码（仅桌面）
                </option>
              </select>
            </label>
          )}
          {st.format === "mp4-h264" && (
            <p className="text-[11px] leading-relaxed text-ink-400">
              {browserMp4
                ? "当前浏览器支持直录 MP4。"
                : "当前浏览器不能直录 MP4。请用较新的 Chrome / Edge，或桌面端用 ffmpeg。"}
              {isTauri() ? (hasFf ? " 本机已找到 ffmpeg。" : " 未找到本机 ffmpeg。") : " Web 版不能调用本机 ffmpeg。"}
            </p>
          )}
          <label className="text-[11px] text-ink-200">
            高度
            <select className="field mt-1" value={st.height} onChange={(e) => useStudio.getState().patchExport({ height: Number(e.target.value) as 1080 | 720 | 480 })}>
              <option value={1080}>1080p</option>
              <option value={720}>720p</option>
              <option value={480}>480p</option>
            </select>
          </label>
          <label className="text-[11px] text-ink-200">
            帧率
            <select className="field mt-1" value={st.fps} onChange={(e) => useStudio.getState().patchExport({ fps: Number(e.target.value) as 24 | 25 | 30 })}>
              <option value={24}>24</option>
              <option value={25}>25</option>
              <option value={30}>30</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-[11px] text-ink-200">
            <input type="checkbox" checked={st.burnCaptions} onChange={(e) => useStudio.getState().patchExport({ burnCaptions: e.target.checked })} />
            烧录字幕条（默认关，预览仍显示文字轨）
          </label>
          <label className="flex items-center gap-2 text-[11px] text-ink-200">
            <input type="checkbox" checked={st.exportSubtitles} onChange={(e) => useStudio.getState().patchExport({ exportSubtitles: e.target.checked })} />
            同时导出字幕文件
          </label>
          {range.active && (
            <label className="flex items-center gap-2 text-[11px] text-ink-200">
              <input type="checkbox" checked={onlyWork} onChange={(e) => setOnlyWork(e.target.checked)} />
              仅导出工作区 {formatMs(range.from, project.fps).slice(3)} – {formatMs(range.to, project.fps).slice(3)}
            </label>
          )}
          {isTauri() && st.format !== "mp4-h264" && (
            <p className="text-[11px] leading-relaxed text-ink-400">
              {hasFf ? "本机已找到 ffmpeg，选 MP4 时可转 H.264。" : "未找到 ffmpeg。选 MP4 时只能走浏览器直录。"}
            </p>
          )}
          {exporting && (
            <div className="h-1.5 overflow-hidden rounded bg-ink-700">
              <div className="h-full bg-copper" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
          {hint && <div className="text-[11px] text-brass">{hint}</div>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" disabled={exporting} onClick={() => useStudio.getState().setDialog(null)}>
            取消
          </button>
          <button
            className="btn btn-accent"
            disabled={exporting}
            onClick={async () => {
              const s = useStudio.getState();
              s.setPlaying(false);
              s.setExporting(true);
                s.setExportHint("正在合成…");
                try {
                  const { blob, ext, srt } = await recordProject(s.project, (r) => {
                    setProgress(r);
                    if (r >= 1) s.setExportHint("正在转码…");
                  }, onlyWork && range.active);
                downloadExport(s.project.name, blob, ext, srt);
                s.setExportHint("已下载");
                s.setDialog(null);
              } catch (err) {
                s.setExportHint(err instanceof Error ? err.message : "导出失败");
              } finally {
                s.setExporting(false);
              }
            }}
          >
            开始导出
          </button>
        </div>
      </div>
    </div>
  );
}
