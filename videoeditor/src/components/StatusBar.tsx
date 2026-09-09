import { formatMs } from "../lib/timeline";
import { durationOf, useStudio, useViewProject } from "../store/useStudio";

export function StatusBar() {
  const project = useViewProject();
  const editingNestId = useStudio((s) => s.editingNestId);
  const jobHint = useStudio((s) => s.jobHint);
  const playheadMs = useStudio((s) => s.playheadMs);
  const snap = useStudio((s) => s.snap);
  const tool = useStudio((s) => s.tool);
  return (
    <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-ink-600 bg-ink-900 px-3 text-[10px] text-ink-400">
      <span>{project.aspect}</span>
      <span>{project.fps} fps</span>
      <span>{formatMs(playheadMs, project.fps)}</span>
      <span>总长 {formatMs(durationOf(project), project.fps)}</span>
      {editingNestId ? <span className="text-copper">正在编辑嵌套</span> : null}
      {jobHint ? <span className="text-copper">{jobHint}</span> : null}
      <span className="ml-auto">{tool === "cut" ? "切割工具 · 点片段切开" : "选择工具"}</span>
      <span>{snap ? "磁吸开" : "磁吸关"}</span>
      <span>I/O 工作区 · Ctrl+C/V 粘贴 · Alt+←→ 微移 · F 适配</span>
    </footer>
  );
}
