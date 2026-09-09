import { Film, Image as ImageIcon, Music, Play, SlidersHorizontal, Subtitles, Type, Upload } from "lucide-react";
import { useEffect, useRef } from "react";
import { mediaUrl } from "../lib/media";
import { formatMs } from "../lib/timeline";
import type { MediaKind } from "../types";
import { useStudio } from "../store/useStudio";

const KIND_ICON: Record<MediaKind, typeof Film> = {
  video: Film,
  audio: Music,
  image: ImageIcon,
};

export function MediaBin() {
  const media = useStudio((s) => s.project.media);
  const selectedMediaId = useStudio((s) => s.selectedMediaId);
  const programPlaying = useStudio((s) => s.playing);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const item = media.find((m) => m.id === selectedMediaId);
  const url = item ? mediaUrl(item.id) : undefined;

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
  }, [selectedMediaId]);

  useEffect(() => {
    if (programPlaying) previewRef.current?.pause();
  }, [programPlaying]);

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-ink-600 bg-ink-900">
      <div className="flex items-center justify-between border-b border-ink-600 px-3 py-2">
        <div className="text-xs font-medium text-paper">素材箱</div>
        <button className="btn" onClick={() => inputRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> 导入
        </button>
        <input
          ref={inputRef}
          type="file"
          hidden
          multiple
          accept="video/*,audio/*,image/*,.srt"
          onChange={(e) => {
            if (e.target.files?.length) void useStudio.getState().importFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!media.length && (
          <div className="px-2 py-8 text-center text-[11px] leading-relaxed text-ink-400">
            导入视频、图片、音频或 SRT。单击预览，双击落到时间轴。视频进主轨会自动带原声。
          </div>
        )}
        <div className="grid gap-1.5">
          {media.map((row) => {
            const Icon = KIND_ICON[row.kind];
            const thumb = row.kind !== "audio" ? mediaUrl(row.id) : undefined;
            const selected = row.id === selectedMediaId;
            return (
              <div
                key={row.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-media-id", row.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => useStudio.getState().setSelectedMedia(row.id)}
                onDoubleClick={() => useStudio.getState().addMediaToTimeline(row.id)}
                className={`flex cursor-grab items-center gap-2 rounded-md border bg-ink-800 p-1.5 ${selected ? "border-brass" : "border-ink-600 hover:border-brass/50"}`}
              >
                <div className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-ink-950">
                  {row.kind === "image" && thumb ? (
                    <img src={thumb} alt="" className="h-full w-full object-cover" />
                  ) : row.kind === "video" && thumb ? (
                    <video src={thumb} muted className="h-full w-full object-cover" />
                  ) : (
                    <Icon className="h-4 w-4 text-ink-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] text-ink-100">{row.name}</div>
                  <div className="text-[10px] text-ink-400">{formatMs(row.durationMs, 24).slice(3)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {item && url && (
        <div className="border-t border-ink-600 p-2">
          <div className="mb-1 truncate text-[10px] text-ink-400">{item.name}</div>
          {item.kind === "image" ? (
            <img src={url} alt="" className="mx-auto max-h-28 object-contain" />
          ) : item.kind === "video" ? (
            <video
              key={item.id}
              ref={(el) => {
                previewRef.current = el;
              }}
              src={url}
              controls
              className="mx-auto max-h-28 w-full bg-ink-950"
              onPlay={() => useStudio.getState().setPlaying(false)}
            />
          ) : (
            <div className="flex items-center gap-2">
              <audio
                key={item.id}
                ref={(el) => {
                  previewRef.current = el;
                }}
                src={url}
                className="w-full"
                controls
                onPlay={() => useStudio.getState().setPlaying(false)}
              />
            </div>
          )}
          <div className="mt-1.5 flex gap-1">
            {item.kind !== "image" && (
              <button
                className="btn flex-1"
                onClick={() => {
                  const el = previewRef.current;
                  if (!el) return;
                  if (el.paused) {
                    useStudio.getState().setPlaying(false);
                    void el.play();
                  } else el.pause();
                }}
              >
                <Play className="h-3.5 w-3.5" />
                预听
              </button>
            )}
            <button className="btn flex-1" onClick={() => useStudio.getState().addMediaToTimeline(item.id)}>
              放到时间轴
            </button>
            <button className="btn flex-1" onClick={() => useStudio.getState().replaceSelectedMedia()}>
              替换选中
            </button>
          </div>
        </div>
      )}
      <div className="flex gap-1 border-t border-ink-600 p-2">
        <button className="btn flex-1" onClick={() => useStudio.getState().addTextAtPlayhead()}>
          <Type className="h-3.5 w-3.5" /> 文字
        </button>
        <button className="btn flex-1" onClick={() => useStudio.getState().addAdjustAtPlayhead()}>
          <SlidersHorizontal className="h-3.5 w-3.5" /> 调节
        </button>
        <button className="btn flex-1" onClick={() => inputRef.current?.click()}>
          <Subtitles className="h-3.5 w-3.5" /> SRT
        </button>
      </div>
    </aside>
  );
}
