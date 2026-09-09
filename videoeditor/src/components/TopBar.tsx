import { Download, FilePlus, FolderOpen, HelpCircle, Pause, Play, Redo2, Save, Scissors, Undo2 } from "lucide-react";
import { isTauri } from "../lib/platform";
import { openProjectJson, saveProjectJson } from "../lib/projectFolder";
import { formatMs } from "../lib/timeline";
import { durationOf, useStudio, useViewProject } from "../store/useStudio";

export function TopBar() {
  const project = useViewProject();
  const editingNestId = useStudio((s) => s.editingNestId);
  const playing = useStudio((s) => s.playing);
  const playheadMs = useStudio((s) => s.playheadMs);
  const past = useStudio((s) => s.past);
  const future = useStudio((s) => s.future);
  const total = durationOf(project);

  return (
    <header className="flex h-12 w-full shrink-0 items-center gap-2 overflow-hidden border-b border-ink-600 bg-ink-900 px-3">
      <div className="mr-1 flex shrink-0 items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-copper text-paper">
          <Scissors className="h-4 w-4" strokeWidth={2.4} />
        </div>
        <div className="hidden min-[900px]:block">
          <div className="flex items-center gap-1.5">
            <div className="font-display text-sm leading-none text-paper">VideoEditor</div>
            <span className="rounded border border-ink-600 px-1 py-px text-[10px] text-ink-400">{isTauri() ? "Tauri" : "Web"}</span>
          </div>
          <div className="text-[10px] text-ink-400">分类型多轨剪辑</div>
        </div>
      </div>
      <input className="field min-w-0 w-36 px-1.5 sm:w-44" value={project.name} onChange={(e) => useStudio.getState().setName(e.target.value)} />
      <select className="field w-20" value={project.aspect} onChange={(e) => useStudio.getState().setAspect(e.target.value as typeof project.aspect)}>
        <option value="16:9">16:9</option>
        <option value="9:16">9:16</option>
        <option value="1:1">1:1</option>
      </select>
      <div className="h-5 w-px bg-ink-600" />
      <button
        className="btn"
        onClick={() => {
          if (project.clips.length && !confirm("新建会丢掉当前未保存的剪辑。继续？")) return;
          useStudio.getState().newProject();
        }}
      >
        <FilePlus className="h-3.5 w-3.5" /> 新建
      </button>
      <button
        className="btn"
        onClick={() => {
          void openProjectJson().then((p) => {
            if (p) useStudio.getState().replaceProject(p);
          });
        }}
      >
        <FolderOpen className="h-3.5 w-3.5" /> 打开
      </button>
      <button className="btn" onClick={() => void saveProjectJson(useStudio.getState().project)}>
        <Save className="h-3.5 w-3.5" /> 保存
      </button>
      <button className="btn" disabled={!past.length} onClick={() => useStudio.getState().undo()}>
        <Undo2 className="h-3.5 w-3.5" />
      </button>
      <button className="btn" disabled={!future.length} onClick={() => useStudio.getState().redo()}>
        <Redo2 className="h-3.5 w-3.5" />
      </button>
      <div className="h-5 w-px bg-ink-600" />
      <button className="btn" onClick={() => useStudio.getState().setPlaying(!playing)}>
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        {playing ? "暂停" : "播放"}
      </button>
      <span className="font-mono text-[11px] text-ink-200">
        {formatMs(playheadMs, project.fps)} / {formatMs(total, project.fps)}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        {editingNestId ? (
          <button className="btn" onClick={() => useStudio.getState().exitNest()}>
            退出嵌套
          </button>
        ) : null}
        <button className="btn" onClick={() => useStudio.getState().setDialog("shop")}>
          商店
        </button>
        <button className="btn" onClick={() => useStudio.getState().setDialog("help")}>
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
        <button className="btn btn-accent" onClick={() => useStudio.getState().setDialog("export")}>
          <Download className="h-3.5 w-3.5" /> 导出
        </button>
      </div>
    </header>
  );
}
