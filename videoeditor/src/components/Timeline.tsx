import { Bookmark, Copy, Link2, Lock, Scissors, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { TrackKind } from "../types";
import { TRACK_LABEL } from "../types";
import { clipDuration, formatMs, sortedTracks, workRange } from "../lib/timeline";
import { canRemoveTrack, compatibleKind, moveClip, placeMedia, placeVideoWithAudio, splitClip, trimClip } from "../lib/ops";
import { lookLabel } from "../lib/looks";
import { ClipWaveform } from "./ClipWaveform";
import { dropTrack, durationOf, lockTrack, muteTrack, useStudio, useViewProject, viewProject } from "../store/useStudio";

const AUDIO_KINDS = new Set<TrackKind>(["audioLinked", "voice", "music", "sfx"]);

const KIND_COLOR: Record<TrackKind, string> = {
  text: "#d4a84b",
  adjust: "#8a6a4a",
  videoOverlay: "#c45c26",
  videoMain: "#4a90c4",
  audioLinked: "#6a9a4a",
  voice: "#c48a3a",
  music: "#7a5ab4",
  sfx: "#3a8a8a",
};

type DragState = {
  id: string;
  mode: "move" | "in" | "out";
  originX: number;
  originStart: number;
  originDur: number;
  trackId: string;
};

export function Timeline() {
  const project = useViewProject();
  const editingNestId = useStudio((s) => s.editingNestId);
  const playheadMs = useStudio((s) => s.playheadMs);
  const selectedClipId = useStudio((s) => s.selectedClipId);
  const selectedMarkerId = useStudio((s) => s.selectedMarkerId);
  const pxPerMs = useStudio((s) => s.pxPerMs);
  const snap = useStudio((s) => s.snap);
  const ripple = useStudio((s) => s.ripple);
  const loopWork = useStudio((s) => s.loopWork);
  const tool = useStudio((s) => s.tool);
  const tracks = sortedTracks(project);
  const duration = durationOf(project) + 4000;
  const range = workRange(project);

  const fitZoom = () => {
    const el = scroller.current;
    if (!el) return;
    const usable = Math.max(200, el.clientWidth - 112);
    useStudio.getState().setPxPerMs(usable / Math.max(1000, durationOf(project)));
  };
  const width = Math.max(800, duration * pxPerMs);
  const scroller = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el || !useStudio.getState().playing) return;
    el.scrollLeft = Math.max(0, playheadMs * pxPerMs - el.clientWidth * 0.4);
  }, [playheadMs, pxPerMs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "KeyF" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        fitZoom();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const msAt = (clientX: number) => {
    const el = scroller.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, (clientX - rect.left + el.scrollLeft - 112) / pxPerMs);
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e: MouseEvent) => {
      const s = useStudio.getState();
      const view = viewProject(s.project, s.editingNestId);
      const delta = (e.clientX - drag.originX) / pxPerMs;
      const playhead = snap ? s.playheadMs : -1e9;
      if (drag.mode === "move") {
        let trackId = drag.trackId;
        for (const node of document.elementsFromPoint(e.clientX, e.clientY)) {
          const id = (node as HTMLElement).dataset?.trackId;
          if (!id) continue;
          const from = view.tracks.find((t) => t.id === drag.trackId);
          const to = view.tracks.find((t) => t.id === id);
          if (from && to && compatibleKind(from.kind, to.kind)) {
            trackId = id;
            break;
          }
        }
        s.mutate((p) => moveClip(p, drag.id, trackId, drag.originStart + delta, playhead), false);
      } else if (drag.mode === "in") {
        s.mutate((p) => trimClip(p, drag.id, "in", drag.originStart + delta, playhead), false);
      } else {
        s.mutate((p) => trimClip(p, drag.id, "out", drag.originStart + drag.originDur + delta, playhead), false);
      }
    };
    const up = () => setDrag(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [drag, pxPerMs, snap]);

  return (
    <section className="flex h-[320px] shrink-0 flex-col border-t border-ink-600 bg-ink-900">
      <div className="flex items-center gap-2 border-b border-ink-600 px-2 py-1.5">
        <button className={`btn ${tool === "select" ? "btn-accent" : ""}`} onClick={() => useStudio.getState().setTool("select")}>
          选择
        </button>
        <button className={`btn ${tool === "cut" ? "btn-accent" : ""}`} onClick={() => useStudio.getState().setTool("cut")}>
          <Scissors className="h-3.5 w-3.5" /> 切割
        </button>
        <button className="btn" onClick={() => useStudio.getState().splitAtPlayhead()}>
          在播放头切开
        </button>
        <button className="btn" onClick={() => useStudio.getState().splitAllAtPlayhead()}>
          切开所有轨
        </button>
        <button className="btn" onClick={() => useStudio.getState().addAdjustAtPlayhead()}>
          调节层
        </button>
        <button className="btn" onClick={() => useStudio.getState().nestWorkArea()}>
          嵌套
        </button>
        {editingNestId ? (
          <button className="btn btn-accent" onClick={() => useStudio.getState().exitNest()}>
            退出嵌套
          </button>
        ) : null}
        <button className="btn" onClick={() => useStudio.getState().addMarkerAtPlayhead()}>
          <Bookmark className="h-3.5 w-3.5" /> 标记
        </button>
        <button className="btn" title="工作区入点 I" onClick={() => useStudio.getState().markIn()}>
          I
        </button>
        <button className="btn" title="工作区出点 O" onClick={() => useStudio.getState().markOut()}>
          O
        </button>
        <button className="btn" title="清除工作区" onClick={() => useStudio.getState().clearWorkArea()}>
          清I/O
        </button>
        <button className="btn" title="适配窗口 F" onClick={fitZoom}>
          适配
        </button>
        <label className="flex items-center gap-1 text-[11px] text-ink-200">
          <input type="checkbox" checked={loopWork} onChange={(e) => useStudio.getState().setLoopWork(e.target.checked)} /> 循环工作区
        </label>
        <button className="btn" onClick={() => useStudio.getState().deleteSelected()}>
          <Trash2 className="h-3.5 w-3.5" /> 删留洞
        </button>
        <button className="btn" onClick={() => useStudio.getState().deleteSelected(true)}>
          Ripple
        </button>
        <button className="btn" onClick={() => useStudio.getState().duplicateSelected()}>
          <Copy className="h-3.5 w-3.5" /> 复制
        </button>
        <label className="flex items-center gap-1 text-[11px] text-ink-200">
          <input type="checkbox" checked={snap} onChange={(e) => useStudio.getState().setSnap(e.target.checked)} /> 磁吸
        </label>
        <label className="flex items-center gap-1 text-[11px] text-ink-200">
          <input type="checkbox" checked={ripple} onChange={(e) => useStudio.getState().setRipple(e.target.checked)} /> 默认 Ripple
        </label>
        <span className="ml-auto text-[11px] text-ink-400">缩放</span>
        <input type="range" min={20} max={400} value={pxPerMs * 1000} onChange={(e) => useStudio.getState().setPxPerMs(Number(e.target.value) / 1000)} />
        <button className="btn" onClick={() => useStudio.getState().addTypedTrack("videoOverlay")}>+ 叠加</button>
        <button className="btn" onClick={() => useStudio.getState().addTypedTrack("adjust")}>+ 调节</button>
        <button className="btn" onClick={() => useStudio.getState().addTypedTrack("text")}>+ 文字</button>
        <button className="btn" onClick={() => useStudio.getState().addTypedTrack("music")}>+ 音乐</button>
        <button className="btn" onClick={() => useStudio.getState().addTypedTrack("voice")}>+ 配音</button>
        <button className="btn" onClick={() => useStudio.getState().addTypedTrack("sfx")}>+ 音效</button>
      </div>
      <div
        ref={scroller}
        className="relative min-h-0 flex-1 overflow-auto"
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest("[data-clip],[data-marker]")) return;
          useStudio.getState().setPlayhead(msAt(e.clientX));
          useStudio.getState().setSelected(null);
          useStudio.getState().setSelectedMarker(null);
        }}
      >
        <div className="sticky top-0 z-20 flex h-6 border-b border-ink-600 bg-ink-900" style={{ width: width + 112 }}>
          <div className="w-28 shrink-0 border-r border-ink-600" />
          <div className="relative h-6" style={{ width }}>
            {Array.from({ length: Math.ceil(duration / 1000) + 1 }, (_, i) => (
              <div key={i} className="absolute top-0 h-full border-l border-ink-700 text-[9px] text-ink-400" style={{ left: i * 1000 * pxPerMs }}>
                <span className="ml-1">{formatMs(i * 1000, project.fps).slice(3, 8)}</span>
              </div>
            ))}
            {(project.markers ?? []).map((m) => (
              <button
                key={m.id}
                data-marker
                className={`absolute top-0 z-10 h-6 -translate-x-1/2 px-0.5 text-[8px] ${selectedMarkerId === m.id ? "text-brass" : "text-copper"}`}
                style={{ left: m.ms * pxPerMs }}
                title={m.label}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  useStudio.getState().setPlayhead(m.ms);
                  useStudio.getState().setSelectedMarker(m.id);
                }}
              >
                <span className="block h-0 w-0 border-x-[4px] border-t-[7px] border-x-transparent border-t-current" />
                <span className="block -translate-x-1/2">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
        {tracks.map((track) => {
          const clips = project.clips.filter((c) => c.trackId === track.id);
          return (
            <div key={track.id} className="flex h-11 border-b border-ink-700">
              <div className="flex w-28 shrink-0 items-center gap-1 border-r border-ink-600 px-1.5">
                <button className="btn-ghost p-0.5" title="静音" onClick={() => muteTrack(track.id)}>
                  {track.muted ? <VolumeX className="h-3.5 w-3.5 text-copper" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>
                <button className="btn-ghost p-0.5" title="锁定" onClick={() => lockTrack(track.id)}>
                  <Lock className={`h-3.5 w-3.5 ${track.locked ? "text-brass" : ""}`} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] text-paper">{track.name}</div>
                  <div className="text-[9px] text-ink-400">{TRACK_LABEL[track.kind]}</div>
                </div>
                {canRemoveTrack(project, track.id) && (
                  <button
                    className="btn-ghost shrink-0 p-0.5"
                    title="删除此轨（轨上片段一并删除）"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => dropTrack(track.id)}
                  >
                    <X className="h-3.5 w-3.5 text-ink-400 hover:text-copper" />
                  </button>
                )}
              </div>
              <div
                className="relative h-11"
                data-track-id={track.id}
                style={{ width }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const mediaId = e.dataTransfer.getData("application/x-media-id");
                  if (!mediaId) return;
                  const media = project.media.find((m) => m.id === mediaId);
                  if (!media) return;
                  const start = msAt(e.clientX);
                  useStudio.getState().mutate((p) => {
                    if (media.kind === "video" && track.kind === "videoMain") return placeVideoWithAudio(p, mediaId, start);
                    if (media.kind === "video" && track.kind === "videoOverlay") return placeMedia(p, mediaId, track.id, start);
                    if (media.kind === "image" && (track.kind === "videoOverlay" || track.kind === "videoMain")) {
                      return placeMedia(p, mediaId, track.id, start);
                    }
                    if (media.kind === "audio" && (track.kind === "voice" || track.kind === "music" || track.kind === "audioLinked" || track.kind === "sfx")) {
                      return placeMedia(p, mediaId, track.id, start);
                    }
                    return p;
                  });
                }}
              >
                {clips.map((clip) => {
                  const left = clip.startMs * pxPerMs;
                  const w = Math.max(8, clipDuration(clip) * pxPerMs);
                  const selected = clip.id === selectedClipId;
                  return (
                    <div
                      key={clip.id}
                      data-clip
                      className={`absolute top-1 h-9 cursor-grab rounded border text-[10px] leading-4 ${selected ? "z-10 ring-1 ring-brass" : "overflow-hidden"}`}
                      style={{
                        left,
                        width: w,
                        background: `${KIND_COLOR[track.kind]}33`,
                        borderColor: KIND_COLOR[track.kind],
                        color: "#f3eee3",
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        useStudio.getState().setSelected(clip.id, track.id);
                        if (tool === "cut") {
                          useStudio.getState().mutate((p) => splitClip(p, clip.id, msAt(e.clientX)));
                          return;
                        }
                        if (track.locked) return;
                        const edge = e.nativeEvent.offsetX < 8 ? "in" : e.nativeEvent.offsetX > w - 8 ? "out" : "move";
                        useStudio.getState().commit();
                        setDrag({
                          id: clip.id,
                          mode: edge,
                          originX: e.clientX,
                          originStart: clip.startMs,
                          originDur: clipDuration(clip),
                          trackId: track.id,
                        });
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (clip.nestId) useStudio.getState().enterNest(clip.nestId);
                      }}
                    >
                      {AUDIO_KINDS.has(track.kind) && clip.mediaId ? (
                        <ClipWaveform
                          clip={clip}
                          mediaDurationMs={project.media.find((m) => m.id === clip.mediaId)?.durationMs ?? clip.outMs}
                          width={w}
                          height={36}
                          color={KIND_COLOR[track.kind]}
                        />
                      ) : null}
                      <div className="relative truncate px-1.5 pt-1">
                        {clip.nestId
                          ? clip.text || "嵌套"
                          : clip.stickerId
                            ? `贴纸 ${clip.text || ""}`
                            : clip.multicam
                              ? `多机 ${project.media.find((m) => m.id === clip.mediaId)?.name || ""}`
                              : track.kind === "adjust"
                                ? lookLabel(clip.look)
                                : clip.text || project.media.find((m) => m.id === clip.mediaId)?.name || "片段"}
                      </div>
                      {clip.linkedClipId ? <Link2 className="absolute right-1 top-1 h-3 w-3 opacity-80" /> : null}
                      {(clip.speed && clip.speed !== 1) || clip.loop || clip.reverse ? (
                        <span className="absolute bottom-0 right-1 text-[8px] opacity-80">
                          {clip.reverse ? "倒放 " : ""}
                          {clip.loop ? "循环" : ""}
                          {clip.speed && clip.speed !== 1 ? ` ${clip.speed}x` : ""}
                        </span>
                      ) : null}
                      {(clip.keys ?? []).map((k) => (
                        <button
                          key={`t-${k.tMs}`}
                          className="absolute top-1/2 z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-paper bg-brass p-0"
                          style={{ left: Math.min(w - 4, Math.max(4, k.tMs * pxPerMs)) }}
                          title="变换关键帧"
                          onMouseDown={(ev) => {
                            ev.stopPropagation();
                            useStudio.getState().setSelected(clip.id, track.id);
                            useStudio.getState().setPlayhead(clip.startMs + k.tMs);
                          }}
                        />
                      ))}
                      {(clip.volKeys ?? []).map((k) => (
                        <button
                          key={`v-${k.tMs}`}
                          className="absolute z-10 h-1.5 w-1.5 -translate-x-1/2 rotate-45 border border-paper bg-copper p-0"
                          style={{ left: Math.min(w - 4, Math.max(4, k.tMs * pxPerMs)), top: "70%" }}
                          title={`音量 ${k.volume.toFixed(2)}`}
                          onMouseDown={(ev) => {
                            ev.stopPropagation();
                            useStudio.getState().setSelected(clip.id, track.id);
                            useStudio.getState().setPlayhead(clip.startMs + k.tMs);
                          }}
                        />
                      ))}
                      {(clip.speedKeys ?? []).map((k) => (
                        <button
                          key={`s-${k.tMs}`}
                          className="absolute z-10 h-1.5 w-1.5 -translate-x-1/2 rotate-45 border border-paper bg-[#5ec8c0] p-0"
                          style={{ left: Math.min(w - 4, Math.max(4, k.tMs * pxPerMs)), top: "22%" }}
                          title={`变速 ${k.speed.toFixed(2)}x`}
                          onMouseDown={(ev) => {
                            ev.stopPropagation();
                            useStudio.getState().setSelected(clip.id, track.id);
                            useStudio.getState().setPlayhead(clip.startMs + k.tMs);
                          }}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {range.active && (
          <div
            className="pointer-events-none absolute top-0 z-20 bg-brass/10"
            style={{
              left: 112 + range.from * pxPerMs,
              width: Math.max(2, (range.to - range.from) * pxPerMs),
              height: "100%",
            }}
          />
        )}
        <div className="pointer-events-none absolute top-0 z-30 w-px bg-copper" style={{ left: 112 + playheadMs * pxPerMs, height: "100%" }} />
      </div>
    </section>
  );
}
