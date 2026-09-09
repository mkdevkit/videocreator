import { useEffect } from "react";
import { TopBar } from "./components/TopBar";
import { MediaBin } from "./components/MediaBin";
import { PreviewPane } from "./components/PreviewPane";
import { Timeline } from "./components/Timeline";
import { Inspector } from "./components/Inspector";
import { StatusBar } from "./components/StatusBar";
import { ExportDialog } from "./components/ExportDialog";
import { HelpDialog } from "./components/HelpDialog";
import { ShopDialog } from "./components/ShopDialog";
import { Playback } from "./components/Playback";
import { waitStageFonts } from "./lib/fonts";
import { workRange } from "./lib/timeline";
import { durationOf, useStudio, viewProject } from "./store/useStudio";

export default function App() {
  const dialog = useStudio((s) => s.dialog);

  useEffect(() => {
    void useStudio.getState().boot();
    void waitStageFonts();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement | null)?.isContentEditable;
      const s = useStudio.getState();
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyY") {
        e.preventDefault();
        s.redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyK") {
        e.preventDefault();
        if (e.shiftKey) s.splitAllAtPlayhead();
        else s.splitAtPlayhead();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyD") {
        e.preventDefault();
        s.duplicateSelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyC") {
        if (typing) return;
        e.preventDefault();
        s.copySelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyX") {
        if (typing) return;
        e.preventDefault();
        s.cutSelected();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyV") {
        if (typing) return;
        e.preventDefault();
        s.pasteClipboard();
        return;
      }
      if (typing) return;
      if (e.code === "KeyM" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        s.addMarkerAtPlayhead();
        return;
      }
      if (e.code === "BracketLeft") {
        e.preventDefault();
        s.jumpMarker(-1);
        return;
      }
      if (e.code === "BracketRight") {
        e.preventDefault();
        s.jumpMarker(1);
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        s.setPlaying(!s.playing);
      } else if (e.code === "Delete" || e.code === "Backspace") {
        e.preventDefault();
        s.deleteSelected(e.shiftKey);
      } else if (e.code === "Home") {
        const view = viewProject(s.project, s.editingNestId);
        const r = workRange(view);
        s.setPlayhead(r.active ? r.from : 0);
      } else if (e.code === "End") {
        const view = viewProject(s.project, s.editingNestId);
        const r = workRange(view);
        s.setPlayhead(r.active ? r.to : durationOf(view));
      } else if (e.code === "ArrowLeft") {
        if (e.altKey) {
          e.preventDefault();
          s.nudgeSelected(-(e.shiftKey ? 1000 : 1000 / s.project.fps));
        } else {
          s.setPlayhead(s.playheadMs - (e.shiftKey ? 1000 : 1000 / s.project.fps));
        }
      } else if (e.code === "ArrowRight") {
        if (e.altKey) {
          e.preventDefault();
          s.nudgeSelected(e.shiftKey ? 1000 : 1000 / s.project.fps);
        } else {
          s.setPlayhead(s.playheadMs + (e.shiftKey ? 1000 : 1000 / s.project.fps));
        }
      } else if (e.code === "KeyI" && !e.ctrlKey) {
        s.markIn();
      } else if (e.code === "KeyO" && !e.ctrlKey) {
        s.markOut();
      } else if (e.altKey && e.code === "KeyX") {
        s.clearWorkArea();
      } else if (e.code === "KeyC" && !e.ctrlKey) {
        s.setTool("cut");
      } else if (e.code === "KeyV" && !e.ctrlKey) {
        s.setTool("select");
      } else if (/^Digit[1-9]$/.test(e.code)) {
        const n = Number(e.code.slice(5)) - 1;
        s.cutMulticamAt(n);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full flex-col bg-ink-950 text-ink-100">
      <Playback />
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <MediaBin />
        <PreviewPane />
        <Inspector />
      </div>
      <Timeline />
      <StatusBar />
      {dialog === "export" && <ExportDialog />}
      {dialog === "help" && <HelpDialog />}
      {(dialog === "filters" || dialog === "shop") && <ShopDialog />}
    </div>
  );
}
