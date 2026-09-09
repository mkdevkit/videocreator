import { useRef, useState } from "react";
import { saveAs } from "file-saver";
import { catalogLooks } from "../lib/looks";
import { loadLocalLooks, parseLookPack, serializeLookPack } from "../lib/lookPack";
import { STICKERS } from "../lib/stickers";
import { TITLE_PRESETS } from "../lib/titles";
import { useStudio } from "../store/useStudio";

type Tab = "滤镜" | "花字" | "贴纸" | "滤镜包";

export function ShopDialog() {
  const [tab, setTab] = useState<Tab>("滤镜");
  const custom = useStudio((s) => s.project.customLooks);
  const fileRef = useRef<HTMLInputElement>(null);
  const looks = catalogLooks([...(custom ?? []), ...loadLocalLooks()]);
  const groups = ["调色", "风格", "镜头", "社区"] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => useStudio.getState().setDialog(null)}>
      <div className="max-h-[84vh] w-full max-w-xl overflow-y-auto rounded-lg border border-ink-600 bg-ink-800 p-4 shadow-paper" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 font-display text-base text-paper">商店</div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(["滤镜", "花字", "贴纸", "滤镜包"] as Tab[]).map((t) => (
            <button key={t} className={`btn ${tab === t ? "btn-accent" : ""}`} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
        {tab === "滤镜" && (
          <>
            <p className="mb-3 text-[11px] leading-relaxed text-ink-400">点选套到当前片段；没选片段时在播放头放调节层。社区栏含内置包和导入的包。</p>
            {groups.map((group) => (
              <div key={group} className="mb-3">
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-ink-400">{group}</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {looks.filter((f) => f.group === group).map((f) => (
                    <button
                      key={f.id}
                      className="btn justify-center"
                      onClick={() => {
                        useStudio.getState().applyStoreFilter(f.id);
                        useStudio.getState().setDialog(null);
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
        {tab === "花字" && (
          <>
            <p className="mb-3 text-[11px] leading-relaxed text-ink-400">套到选中文字；没选时在播放头新建一段。</p>
            {(["字幕", "花字", "标题"] as const).map((group) => (
              <div key={group} className="mb-3">
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-ink-400">{group}</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {TITLE_PRESETS.filter((t) => t.group === group).map((t) => (
                    <button
                      key={t.id}
                      className="btn justify-center"
                      onClick={() => {
                        useStudio.getState().applyTitlePreset(t.id);
                        useStudio.getState().setDialog(null);
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
        {tab === "贴纸" && (
          <>
            <p className="mb-3 text-[11px] leading-relaxed text-ink-400">放到文字轨，可拖位置、缩放。预览导出同一路径。</p>
            {(["表情", "标记", "形状"] as const).map((group) => (
              <div key={group} className="mb-3">
                <div className="mb-1.5 text-[10px] uppercase tracking-wide text-ink-400">{group}</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {STICKERS.filter((s) => s.group === group).map((s) => (
                    <button
                      key={s.id}
                      className="btn justify-center"
                      onClick={() => {
                        useStudio.getState().placeSticker(s.id);
                        useStudio.getState().setDialog(null);
                      }}
                    >
                      {s.glyph} {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
        {tab === "滤镜包" && (
          <div className="grid gap-2">
            <p className="text-[11px] leading-relaxed text-ink-400">
              没有在线社区后台。可导入/导出 JSON 滤镜包，保存在本机并写入当前工程。别人给你的包丢进来即用。
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                void file.text().then((text) => {
                  try {
                    useStudio.getState().importLookPack(parseLookPack(text));
                  } catch (err) {
                    alert(err instanceof Error ? err.message : "滤镜包无效");
                  }
                });
              }}
            />
            <button className="btn" onClick={() => fileRef.current?.click()}>
              导入滤镜包
            </button>
            <button
              className="btn"
              onClick={() => {
                const pack = [...(custom ?? []), ...loadLocalLooks()];
                if (!pack.length) {
                  alert("还没有可导出的社区滤镜");
                  return;
                }
                saveAs(new Blob([serializeLookPack(pack)], { type: "application/json" }), "filter-pack.json");
              }}
            >
              导出本机滤镜包
            </button>
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <button className="btn" onClick={() => useStudio.getState().setDialog(null)}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
