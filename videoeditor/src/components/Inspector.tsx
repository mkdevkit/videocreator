import { Unlink } from "lucide-react";
import { STAGE_FONTS } from "../lib/fonts";
import { sampleTransform, sampleVolume, sortedKeys, sortedVolKeys } from "../lib/keys";
import { catalogLooks, applyLook, lookLabel } from "../lib/looks";
import { loadLocalLooks } from "../lib/lookPack";
import { sampleMulticamAngle } from "../lib/multicam";
import { clipDuration, clipSpeed, sampleSpeed, sortedSpeedKeys } from "../lib/timeline";
import { dropKey, dropSpeedKey, dropVolKey, patchSelected, poseSelected, reverseSelected, speedSelected, useStudio, useViewProject, volSelected } from "../store/useStudio";
import { CLIP_SPEEDS, DEFAULT_AUDIO_FX, DEFAULT_CHROMA, DEFAULT_FX, DEFAULT_GRADE, DEFAULT_TEXT_STYLE, type StageFontId, type TransitionKind } from "../types";

export function Inspector() {
  const project = useViewProject();
  const selectedClipId = useStudio((s) => s.selectedClipId);
  const selectedMediaId = useStudio((s) => s.selectedMediaId);
  const playheadMs = useStudio((s) => s.playheadMs);
  const clip = project.clips.find((c) => c.id === selectedClipId);
  const track = project.tracks.find((t) => t.id === clip?.trackId);
  const style = { ...DEFAULT_TEXT_STYLE, ...clip?.textStyle };
  const pose = clip ? sampleTransform(clip, playheadMs) : null;
  const visual = track && (track.kind === "videoOverlay" || track.kind === "videoMain" || track.kind === "text");
  const audio = track && (track.kind === "audioLinked" || track.kind === "voice" || track.kind === "music" || track.kind === "sfx");
  const colorable = track && (track.kind === "videoMain" || track.kind === "videoOverlay" || track.kind === "adjust");
  const vol = clip ? sampleVolume(clip, playheadMs) : 0;
  const looks = catalogLooks([...(project.customLooks ?? []), ...loadLocalLooks()]);
  const fx = { ...DEFAULT_AUDIO_FX, ...clip?.audioFx };

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-ink-600 bg-ink-900">
      <div className="border-b border-ink-600 px-3 py-2 text-xs font-medium text-paper">检视</div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!clip || !track || !pose ? (
          <p className="text-[11px] leading-relaxed text-ink-400">选中片段后改音量、变换、关键帧、调色、抠像、变速曲线和字幕。顶栏「滤镜」可套内置效果。</p>
        ) : (
          <div className="grid gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-ink-400">{track.name}</div>
              <div className="text-xs text-paper">
                {track.kind === "adjust" ? lookLabel(clip.look, looks) : clip.text || project.media.find((m) => m.id === clip.mediaId)?.name || clip.id}
              </div>
              <div className="text-[10px] text-ink-400">{Math.round(clipDuration(clip))} ms · {clipSpeed(clip)}x</div>
            </div>
            {clip.linkedClipId && (
              <button className="btn" onClick={() => useStudio.getState().unlinkSelected()}>
                <Unlink className="h-3.5 w-3.5" /> 解绑原声
              </button>
            )}
            {clip.mediaId && selectedMediaId && selectedMediaId !== clip.mediaId && (
              <button className="btn" onClick={() => useStudio.getState().replaceSelectedMedia()}>
                用素材箱选中项替换
              </button>
            )}
            {(clip.mediaId || clip.nestId) && (
              <fieldset className="grid gap-1.5">
                <legend className="text-[11px] text-ink-200">变速</legend>
                <select className="field" value={clipSpeed(clip)} onChange={(e) => speedSelected(Number(e.target.value))}>
                  {CLIP_SPEEDS.map((s) => (
                    <option key={s} value={s}>
                      {s}x
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-[11px] text-ink-200">
                  <input type="checkbox" checked={Boolean(clip.reverse)} onChange={(e) => reverseSelected(e.target.checked)} />
                  倒放
                </label>
                {(track.kind === "music" || track.kind === "sfx" || track.kind === "voice") && (
                  <label className="flex items-center gap-2 text-[11px] text-ink-200">
                    <input type="checkbox" checked={clip.loop} onChange={(e) => patchSelected({ loop: e.target.checked })} />
                    循环（拖长片段会重复素材）
                  </label>
                )}
                <Num
                  label="曲线速度"
                  value={sampleSpeed(clip, playheadMs)}
                  step={0.05}
                  min={0.25}
                  max={4}
                  onChange={(speed) => useStudio.getState().speedKeySelected(speed)}
                />
                <button className="btn" onClick={() => useStudio.getState().speedKeySelected(sampleSpeed(clip, playheadMs))}>
                  在播放头打变速点
                </button>
                {sortedSpeedKeys(clip).length > 0 && (
                  <div className="grid gap-1">
                    {sortedSpeedKeys(clip).map((k) => (
                      <div key={k.tMs} className="flex items-center justify-between text-[10px] text-ink-200">
                        <button className="btn-ghost px-1" onClick={() => useStudio.getState().setPlayhead(clip.startMs + k.tMs)}>
                          {Math.round(k.tMs)} ms · {k.speed.toFixed(2)}x
                        </button>
                        <button className="btn-ghost px-1 text-copper" onClick={() => dropSpeedKey(k.tMs)}>
                          删
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </fieldset>
            )}
            {clip.nestId && (
              <button className="btn" onClick={() => useStudio.getState().enterNest(clip.nestId!)}>
                进入嵌套
              </button>
            )}
            {visual && (
              <fieldset className="grid gap-1.5">
                <legend className="text-[11px] text-ink-200">变换（当前时间）</legend>
                <Num label="X %" value={pose.x} onChange={(x) => poseSelected({ x })} />
                <Num label="Y %" value={pose.y} onChange={(y) => poseSelected({ y })} />
                <Num label="缩放" value={pose.scale} step={0.05} onChange={(scale) => poseSelected({ scale })} />
                <Num label="旋转 °" value={pose.rotation ?? 0} step={1} max={360} min={-360} onChange={(rotation) => poseSelected({ rotation })} />
                <Num label="透明度" value={pose.opacity} step={0.05} max={1} onChange={(opacity) => poseSelected({ opacity })} />
                <button className="btn" onClick={() => poseSelected({}, true)}>
                  <span className="inline-block h-2 w-2 rotate-45 bg-brass" /> 在播放头打关键帧
                </button>
                {sortedKeys(clip).length > 0 && (
                  <div className="grid gap-1">
                    {sortedKeys(clip).map((k) => (
                      <div key={k.tMs} className="flex items-center justify-between text-[10px] text-ink-200">
                        <button className="btn-ghost px-1" onClick={() => useStudio.getState().setPlayhead(clip.startMs + k.tMs)}>
                          {Math.round(k.tMs)} ms
                        </button>
                        <button className="btn-ghost px-1 text-copper" onClick={() => dropKey(k.tMs)}>
                          删
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </fieldset>
            )}
            {track.kind === "adjust" && pose && (
              <fieldset className="grid gap-1.5">
                <legend className="text-[11px] text-ink-200">调节层（盖在画面上）</legend>
                <p className="text-[10px] leading-relaxed text-ink-400">无素材。透明度是效果混合量；文字仍画在最上面。</p>
                <Num label="混合" value={pose.opacity} step={0.05} max={1} onChange={(opacity) => poseSelected({ opacity })} />
              </fieldset>
            )}
            {audio && (
              <fieldset className="grid gap-1.5">
                <legend className="text-[11px] text-ink-200">音频</legend>
                <Num label="音量" value={vol} step={0.05} max={1} onChange={(volume) => volSelected(volume)} />
                <button className="btn" onClick={() => volSelected(vol, true)}>
                  <span className="inline-block h-2 w-2 rotate-45 bg-copper" /> 在播放头打音量关键帧
                </button>
                {sortedVolKeys(clip).length > 0 && (
                  <div className="grid gap-1">
                    {sortedVolKeys(clip).map((k) => (
                      <div key={k.tMs} className="flex items-center justify-between text-[10px] text-ink-200">
                        <button className="btn-ghost px-1" onClick={() => useStudio.getState().setPlayhead(clip.startMs + k.tMs)}>
                          {Math.round(k.tMs)} ms · {k.volume.toFixed(2)}
                        </button>
                        <button className="btn-ghost px-1 text-copper" onClick={() => dropVolKey(k.tMs)}>
                          删
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <Num label="淡入 ms" value={clip.fadeInMs} step={50} max={5000} onChange={(fadeInMs) => patchSelected({ fadeInMs })} />
                <Num label="淡出 ms" value={clip.fadeOutMs} step={50} max={5000} onChange={(fadeOutMs) => patchSelected({ fadeOutMs })} />
                {track.kind === "music" && (
                  <>
                    <label className="flex items-center gap-2 text-[11px] text-ink-200">
                      <input type="checkbox" checked={clip.duck !== false} onChange={(e) => patchSelected({ duck: e.target.checked })} />
                      配音时闪避
                    </label>
                    <Num label="闪避后音量" value={clip.duckTo ?? 0.22} step={0.05} max={1} onChange={(duckTo) => patchSelected({ duckTo })} />
                  </>
                )}
                <Num label="降噪" value={fx.denoise} step={0.05} max={1} onChange={(denoise) => patchSelected({ audioFx: { ...fx, denoise } })} />
                <Num label="低频 dB" value={fx.low} step={0.5} min={-12} max={12} onChange={(low) => patchSelected({ audioFx: { ...fx, low } })} />
                <Num label="中频 dB" value={fx.mid} step={0.5} min={-12} max={12} onChange={(mid) => patchSelected({ audioFx: { ...fx, mid } })} />
                <Num label="高频 dB" value={fx.high} step={0.5} min={-12} max={12} onChange={(high) => patchSelected({ audioFx: { ...fx, high } })} />
              </fieldset>
            )}
            {colorable && (
              <fieldset className="grid gap-1.5">
                <legend className="text-[11px] text-ink-200">调色</legend>
                <select className="field" value={clip.look || "none"} onChange={(e) => patchSelected(applyLook(e.target.value, looks))}>
                  {looks.map((look) => (
                    <option key={look.id} value={look.id}>
                      {look.label}
                    </option>
                  ))}
                </select>
                <Num
                  label="亮度"
                  value={(clip.grade ?? DEFAULT_GRADE).brightness}
                  step={0.05}
                  max={2}
                  onChange={(brightness) => patchSelected({ grade: { ...(clip.grade ?? DEFAULT_GRADE), brightness } })}
                />
                <Num
                  label="对比"
                  value={(clip.grade ?? DEFAULT_GRADE).contrast}
                  step={0.05}
                  max={2}
                  onChange={(contrast) => patchSelected({ grade: { ...(clip.grade ?? DEFAULT_GRADE), contrast } })}
                />
                <Num
                  label="饱和"
                  value={(clip.grade ?? DEFAULT_GRADE).saturate}
                  step={0.05}
                  max={3}
                  onChange={(saturate) => patchSelected({ grade: { ...(clip.grade ?? DEFAULT_GRADE), saturate } })}
                />
                <Num
                  label="暗角"
                  value={clip.vignette ?? 0}
                  step={0.05}
                  max={1}
                  onChange={(vignette) => patchSelected({ vignette })}
                />
                <Num label="模糊" value={clip.fx?.blur ?? 0} step={0.2} max={8} onChange={(blur) => patchSelected({ fx: { ...DEFAULT_FX, ...clip.fx, blur } })} />
                <Num label="色相 °" value={clip.fx?.hue ?? 0} step={1} min={-180} max={180} onChange={(hue) => patchSelected({ fx: { ...DEFAULT_FX, ...clip.fx, hue } })} />
              </fieldset>
            )}
            {(track.kind === "videoMain" || track.kind === "videoOverlay") && (
              <fieldset className="grid gap-1.5">
                <legend className="text-[11px] text-ink-200">抠像</legend>
                <label className="flex items-center gap-2 text-[11px] text-ink-200">
                  <input
                    type="checkbox"
                    checked={Boolean(clip.chroma?.enabled)}
                    onChange={(e) => patchSelected({ chroma: { ...(clip.chroma ?? DEFAULT_CHROMA), enabled: e.target.checked } })}
                  />
                  启用绿幕 / 色键
                </label>
                <label className="grid gap-1 text-[11px] text-ink-200">
                  键色
                  <input
                    type="color"
                    className="h-8 w-full rounded border border-ink-600 bg-ink-800"
                    value={clip.chroma?.color ?? "#00ff00"}
                    onChange={(e) => patchSelected({ chroma: { ...(clip.chroma ?? DEFAULT_CHROMA), enabled: true, color: e.target.value } })}
                  />
                </label>
                <Num
                  label="相似度"
                  value={clip.chroma?.similarity ?? 0.28}
                  step={0.02}
                  max={1}
                  onChange={(similarity) => patchSelected({ chroma: { ...(clip.chroma ?? DEFAULT_CHROMA), enabled: true, similarity } })}
                />
                <Num
                  label="边缘"
                  value={clip.chroma?.smoothness ?? 0.12}
                  step={0.02}
                  max={1}
                  onChange={(smoothness) => patchSelected({ chroma: { ...(clip.chroma ?? DEFAULT_CHROMA), enabled: true, smoothness } })}
                />
              </fieldset>
            )}
            {track.kind === "videoMain" && (
              <fieldset className="grid gap-1.5">
                <legend className="text-[11px] text-ink-200">转场（接到下一段）</legend>
                <select
                  className="field"
                  value={clip.transition ?? "cut"}
                  onChange={(e) => patchSelected({ transition: e.target.value as TransitionKind })}
                >
                  <option value="cut">切</option>
                  <option value="fade">淡入淡出</option>
                  <option value="dissolve">叠化</option>
                </select>
                <Num label="时长 ms" value={clip.transitionMs} step={50} max={2000} onChange={(transitionMs) => patchSelected({ transitionMs })} />
              </fieldset>
            )}
            {(track.kind === "videoMain" || track.kind === "videoOverlay") && clip.mediaId && (
              <fieldset className="grid gap-1.5">
                <legend className="text-[11px] text-ink-200">稳定 / 跟踪</legend>
                <p className="text-[10px] leading-relaxed text-ink-400">稳定先分析再补偿抖动。跟踪从播放头按当前中心点往后写位置关键帧。</p>
                <Num label="稳定量" value={clip.stabilize ?? 0} step={0.05} max={1} onChange={(stabilize) => patchSelected({ stabilize })} />
                <button className="btn" onClick={() => void useStudio.getState().stabilizeSelected()}>
                  {clip.stab ? "重新分析稳定" : "分析稳定"}
                </button>
                <button className="btn" onClick={() => void useStudio.getState().trackSelected()}>
                  从播放头跟踪
                </button>
              </fieldset>
            )}
            {(track.kind === "videoMain" || track.kind === "videoOverlay") && clip.mediaId && (
              <fieldset className="grid gap-1.5">
                <legend className="text-[11px] text-ink-200">多机位</legend>
                <p className="text-[10px] leading-relaxed text-ink-400">素材箱选另一段视频后「加为机位」。1–9 在播放头切机位。</p>
                <button className="btn" onClick={() => useStudio.getState().addMulticamAngle()}>
                  把素材箱选中项加为机位
                </button>
                {clip.multicam?.angles.map((a, i) => (
                  <button
                    key={a.mediaId}
                    className={`btn ${sampleMulticamAngle(clip, playheadMs) === i ? "btn-accent" : ""}`}
                    onClick={() => useStudio.getState().cutMulticamAt(i)}
                  >
                    {a.label} · {project.media.find((m) => m.id === a.mediaId)?.name ?? a.mediaId}
                  </button>
                ))}
              </fieldset>
            )}
            {track.kind === "text" && (
              <fieldset className="grid gap-1.5">
                <legend className="text-[11px] text-ink-200">字幕</legend>
                <textarea className="field min-h-[72px]" value={clip.text ?? ""} onChange={(e) => patchSelected({ text: e.target.value })} />
                <select
                  className="field"
                  value={style.fontId}
                  onChange={(e) => patchSelected({ textStyle: { ...style, fontId: e.target.value as StageFontId } })}
                >
                  {STAGE_FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <Num label="字号 %" value={style.fontSize} step={0.2} onChange={(fontSize) => patchSelected({ textStyle: { ...style, fontSize } })} />
                <label className="grid gap-1 text-[11px] text-ink-200">
                  颜色
                  <input
                    type="color"
                    className="h-8 w-full rounded border border-ink-600 bg-ink-800"
                    value={style.color}
                    onChange={(e) => patchSelected({ textStyle: { ...style, color: e.target.value } })}
                  />
                </label>
                <select
                  className="field"
                  value={style.align}
                  onChange={(e) => patchSelected({ textStyle: { ...style, align: e.target.value as "left" | "center" | "right" } })}
                >
                  <option value="left">左</option>
                  <option value="center">中</option>
                  <option value="right">右</option>
                </select>
              </fieldset>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function Num({
  label,
  value,
  onChange,
  step = 1,
  max = 200,
  min,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  max?: number;
  min?: number;
}) {
  return (
    <label className="grid gap-0.5 text-[11px] text-ink-200">
      {label}
      <input
        type="number"
        className="field"
        step={step}
        min={min}
        max={max}
        value={Number.isFinite(value) ? Number(value.toFixed(3)) : 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
