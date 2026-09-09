import { useStudio } from "../store/useStudio";

export function HelpDialog() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => useStudio.getState().setDialog(null)}>
      <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border border-ink-600 bg-ink-800 p-4 shadow-paper" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 font-display text-base text-paper">快捷键与轨</div>
        <ul className="grid gap-1.5 text-[12px] leading-relaxed text-ink-200">
          <li>时间轴从上到下：文字 → 调节 → 叠加 → 主视频 → 原声 → 配音 → 音乐 → 音效。</li>
          <li>导入视频会同时放到主视频轨和原声轨，默认联动；检视里可解绑。</li>
          <li>空格播放，Ctrl+K 切开选中段，Ctrl+Shift+K 切开所有轨，Ctrl+D 复制，Delete 留洞，Shift+Delete Ripple。</li>
          <li>I / O 标工作区入出点，Alt+X 清除；导出可只出这一段。勾选「循环工作区」后预览在区内打转。</li>
          <li>Ctrl+C / X / V 复制剪切粘贴到播放头；Alt+←→ 微移片段（Shift 为 1 秒）。F 时间轴适配窗口。</li>
          <li>M 在播放头打标记，[ / ] 跳到上一/下一标记，选中标记后 Delete 删除。磁吸会对齐标记。</li>
          <li>原声 / 配音 / 音乐 / 音效片段显示波形。素材箱单击预览预听，双击落到时间轴。</li>
          <li>素材箱「调节」在播放头放一层调色/暗角，盖在主视频和叠加上、文字之下。</li>
          <li>检视：变速 0.5x–2x、倒放、循环、调色预设、旋转。音乐默认可被配音闪避；音量可打关键帧。</li>
          <li>变速曲线：检视「曲线速度」或「打变速点」，时间轴上浅色菱形。只改素材消耗，不改片段长度。</li>
          <li>顶栏「商店」：滤镜、花字、贴纸；滤镜包可导入导出 JSON（本机，没有在线社区后台）。</li>
          <li>音频检视：降噪（高通+门限）和低/中/高三段 EQ，预览导出同一条混音。</li>
          <li>稳定：先「分析稳定」再拉稳定量。跟踪：先把画面中心对准目标，再「从播放头跟踪」写位置关键帧。</li>
          <li>多机位：素材箱选另一视频后加为机位，1–9 或检视按钮在播放头切机位。</li>
          <li>抠像：主视频 / 叠加检视里开绿幕，改键色、相似度、边缘。预览导出同一路径。</li>
          <li>嵌套：标工作区后点「嵌套」，或无工作区时从播放头起 5 秒。双击嵌套段或检视「进入嵌套」；时间轴 / 顶栏退出。</li>
          <li>预览拖位置；滚轮缩放，Shift+滚轮旋转。播放头不在起点时自动打关键帧。</li>
          <li>导出选 MP4 时可指定编码：浏览器直录（Chrome / Edge）、本机 ffmpeg（仅桌面）、或自动。</li>
          <li>预览和导出走同一条 canvas 合成路径。字体 SIL OFL，烧录字幕默认关。</li>
        </ul>
        <div className="mt-4 flex justify-end">
          <button className="btn" onClick={() => useStudio.getState().setDialog(null)}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
