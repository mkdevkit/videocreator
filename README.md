# videocreator

口播网页转视频工具集。

| 目录 | 说明 |
| --- | --- |
| [`web2video`](./web2video) | 网页场景编辑器（Web / Tauri）：口播列表、元件动效（口播/场景/固定时间）、千问配音、按语言导出 |
| [`script2video`](./script2video) | 脚本工作台（Web / Tauri）：口播驱动或脚本驱动、DeepSeek、翻译、千问配音（角色/音色管理）、画面跟节拍走 |
| [`videoeditor`](./videoeditor) | 分类型多轨剪辑器（Web / Tauri）：文字/调节/叠加/主视频/原声/配音/音乐/音效，预览导出同一合成器 |

```bash
cd web2video       # 网页场景编辑器
# 或
cd script2video    # 脚本 / 口播 / 翻译 / 配音
# 或
cd videoeditor     # 多轨剪辑（端口 5175）
npm install
npm run dev        # 浏览器
npm run tauri:dev  # 桌面（需 Rust）
```

建议 **Chrome 或 Edge**。开发时必须用 `npm run dev`，本机 Vite 插件会代理千问 TTS、LLM 和 Edge 翻译。密钥只存在本机 `localStorage`，不进工程文件。

两个工具的界面与成片字体均为 **SIL OFL（免费可商用）**，字文件随工具打包，默认与回落都是 Noto 等开源字体，不走系统字体、也不依赖 Google Fonts。明细见各工具 README。

## 预览和导出

**每个工具内部：所见即所导。** 预览和导出走同一条画面路径，字体不会预览一套、导出另一套。导出前都会等打包字体就绪再录。

差别主要是壳：预览会缩放、可点选；导出用成片分辨率、不可编辑。烧录字幕默认关，只在导出窗勾了才画进成片（预览仍可显示文字）。

**三个工具之间：** 字体政策对齐（SIL OFL、随工具打包、栈末回落 Noto、不走系统字体）。`waitStageFonts` 是同一套思路，各写各的。画面不是共用一套渲染。

| | Web2Video | Script2Video | VideoEditor |
| --- | --- | --- | --- |
| 画什么 | 版面元件 | 舞台 HTML + GSAP | 时间轴片段（视频/图/字） |
| 默认字 | 片级「元件默认」+ 字幕 | 工程 `stageTheme` | 文字轨 Noto |
| 覆盖 | 检视里改该元件 | HTML/CSS 或 `var(--stage-*)` | 检视里改该片段 |
| 预览 = 导出 | `StageLayers` → `StageView` | `mountStage` + `stageTexts` + GSAP | `drawFrame` |

Script2Video 引擎不是 GSAP（Remotion / Manim）时，工作台预览/导出可能只是节拍卡，完整画面要到该引擎里渲。

## MCP

两边的「工具」都是 `src/lib/ai/tools.ts`：`AI_TOOLS` 是 JSON Schema，`executeTool` 改当前打开的工程（Zustand），`SYSTEM_PROMPT` 是约定。应用内 AI（DeepSeek 等）走 `agent.ts` 的 function calling。密钥、翻译、配音合成不要让模型代劳。

| | Web2Video | Script2Video |
| --- | --- | --- |
| 应用内 AI | 有：右侧 AI 页，同一套 `executeTool` | 有：中间 AI 页，同一套 `executeTool` |
| Cursor MCP（stdio） | 有：`.cursor/mcp.json` → `web2video/mcp/server.mjs` | 无独立 stdio 进程；工具只在工作台里调 |
| 改的对象 | 当前打开的场景工程（须先 `npm run dev` / `tauri:dev`） | 当前打开的脚本工程 |
| 粒度 | 一场 | 一条脚本 |

### Web2Video（Cursor 可调）

编辑器必须先开着。开发服务器在 `http://127.0.0.1:5173` 提供桥：

1. 页面 `src/lib/mcpBridge.ts` 连 `ws://…/__mcp`，上报 `AI_TOOLS`，收到 `call` 后跑 `executeTool`
2. `vite-plugin-mcp-bridge.ts` 把 HTTP 转到这条 WebSocket：`GET /__mcp/health`、`GET /__mcp/tools`、`POST /__mcp/call`
3. `mcp/server.mjs` 是 stdio MCP（JSON-RPC + `Content-Length`），`tools/list` / `tools/call` 去打上面的 HTTP

仓库 [`.cursor/mcp.json`](./.cursor/mcp.json) 已登记。Cursor 里启用 `web2video`；编辑器未开时调用会失败。

读：`get_project`、`get_scene`、`list_catalog`  
写：`apply_storyboard`、`update_scene`、`manage_scenes`、`manage_blocks`、`set_visual_text`、`set_cue`、`set_project`

元件含 `katex`（`settings.tex`）、`three`（`settings.threeSrc`，seek，不要 rAF）。不要编造媒体 URL。

### Script2Video（仅工作台内）

没有 stdio MCP。Cursor 不能直接改脚本工程。工作台 AI 用同一套工具文件：

读：`get_project`、`get_script`、`list_catalog`  
写：`apply_scripts`、`update_script`、`manage_scripts`、`manage_beats`、`manage_stage_texts`、`set_project`

画面时长用 `speech.s(id)` / `holdS` / `play`，不要写死秒数。口播驱动按 beats 列表；脚本驱动必须 `speech.play(id)`。

明细见 [`web2video/README.md`](./web2video/README.md#mcp) 与 [`script2video/README.md`](./script2video/README.md#mcp)。
