# Web2Video

把口播做成网页场景：版面元件、多语言文案、千问 TTS、时间轴动画，再按语言导出视频（可选字幕文件）。同一套 UI 可跑在浏览器（Vite）或桌面（Tauri）。

建议 **Chrome 或 Edge**（浏览器依赖 File System Access、MediaRecorder、IndexedDB）。

```bash
npm install
npm run dev
```

打开 http://localhost:5173 。必须用 `npm run dev`：本机 Vite 插件会代理千问 TTS、LLM 和 Edge 翻译，避免浏览器跨域。

**桌面（Tauri）**

需本机已装 [Rust](https://rustup.rs/)（含 `cargo`）。

```bash
npm install
npm run tauri:dev     # 开发：嵌同一套前端
npm run tauri:build   # 安装包；可执行文件为 Web2Video.exe，图标来自 favicon
```

| | Web | Tauri |
| --- | --- | --- |
| UI | 同一套 React | 同一套 React |
| 翻译 / TTS / LLM 开发期 | Vite 插件 `/__edge_translate`、`/__tts/qwen`、`/__llm/chat` | 同样走 Vite（`tauri dev`） |
| 翻译 / TTS 打包后 | 仍需本机预览服务器，或以后接后端 | Rust 命令直连 Edge / DashScope |
| 工程文件 | 目录选择器；可选 JSON 下载 | 原生打开 / 保存 `project.json` + `scene.json` + `aisession.json` + `media/` |


## 功能

- 视频 / GIF 元件（跟场景时间走，导出时按当前帧画进画面）
- 公式（KaTeX）与三维（Three.js）元件：公式写 TeX；三维脚本跟播放头 seek，导出时画进画面
- 多种版面：封面、图文、要点、金句、步骤、对话窗、自定义等
- 场景底色 / 背景图、口播字幕条（字体与样式可配，烧录到画面）、画布进度条（样式可配，画在舞台上会进导出）
- 每场独立口播表（id、只读时长、角色、九种语言同一行）；口播驱动或配置驱动
- 元件可配多条动效：起点/终点分口播、场景锚点、固定时间；终点也可设时长。缓推缩放等
- 配置驱动用「播放口播」元件排期；开场/结束空白只在此模式下生效
- 工作区底部只有全片进度条；画布进度条（`showTopProgress`）会进导出
- 点舞台元件显示该元件属性（含动效）；点空白回到场景属性
- 千问 TTS：合成 / AI 配置 / 配音角色 / 音色管理；各语言可指定默认角色
- 「翻译后合成语音」默认关闭
- 生成式 AI 分镜（DeepSeek 等 Chat Completions + 本地工具调用）；同一套工具可通过 MCP 给 Cursor 调用（需先打开编辑器）
- 一键机翻：中、英、日、法、德、俄、西班牙、葡萄牙、意大利
- 导出 WebM（VP8/VP9）或 MP4（H.264，视浏览器而定）；分辨率 / 帧率 / 码率可配
- 默认不烧录字幕、不另存字幕文件；导出窗里勾选后才写 SRT / VTT，或只出一段视频、配多语言字幕（同一时间轴）
- 工程写入所选目录下的「项目名」子文件夹：`project.json`（片级）+ `scene.json`（场景）+ `aisession.json`（AI 会话）+ `media/`。旧版把场景写在 `project.json` 里仍能打开，再保存会拆开。

## 字体

全部为 **SIL Open Font License**，免费可商用。字文件随工具打包（[Fontsource](https://fontsource.org/) 的 woff2），**不请求 Google Fonts**。离线导出也是同一套。

| 用在哪 | 字体 | 许可 |
| --- | --- | --- |
| 工作台界面（按钮、表单、检视） | DM Sans、Noto Sans SC | SIL OFL |
| 工作台标题（顶栏品牌、对话框标题） | Fraunces、Noto Serif SC | SIL OFL |
| 画面元件（未单独指定） | 配置 → 字体 → 元件默认（默认 Noto Sans） | SIL OFL |
| 口播字幕条（预览与烧录到画面） | 配置 → 字体 → 口播字幕（默认 Noto Sans） | SIL OFL |
| 画布进度条场次名 | 配置 → 字体 → 进度条场次名（可回落字幕字体） | SIL OFL |
| 公式元件 | KaTeX 自带（KaTeX_*） | SIL OFL |
| 单个元件覆盖 | 检视里可选；缺省跟元件默认 | SIL OFL |
| 中日文缺字回落 | Noto Sans/Serif SC、JP；IBM Plex 日文走 IBM Plex Sans JP | SIL OFL |

成片可选字体（配置里下拉，均为 SIL OFL）：Noto Sans / Noto Serif、Source Sans 3 / Source Serif 4、IBM Plex Sans、PT Sans、Nunito Sans、Inter、Literata、DM Sans。工作台「配置 → 字体」与「?」帮助里分「用在哪」「每种字体」两页表。标题、金句等也是元件：全局只配「元件默认」和字幕；某个元件要换字体，在检视里选，说明与配置目录同样详细。

## 技术方案

纯前端单页应用，不自建后端。密钥只存在本机 `localStorage`，不进工程文件。

### 栈

| 层 | 选用 |
| --- | --- |
| 构建 | Vite 6 + TypeScript + `@vitejs/plugin-react-swc` |
| UI | React 18、Tailwind CSS、lucide-react |
| 公式 / 三维 | KaTeX、Three.js（元件内 seek 渲染，无独立 rAF） |
| 状态 | Zustand（工程、播放头、撤销栈、对话框） |
| 配音 | 阿里云百炼 / 千问 TTS（设计 `qwen-voice-design`、复刻 `qwen-voice-enrollment`、合成 `qwen3-tts-vd` / `qwen3-tts-vc`） |
| 分镜 AI | OpenAI 兼容 Chat Completions（默认 DeepSeek），function calling |
| 翻译 | Microsoft Edge 翻译接口（Vite 反代 `/__edge_translate`） |
| 导出画面 | `html-to-image` 逐帧截舞台 → `canvas.captureStream` + `MediaRecorder`；视频/GIF/三维先画到 2D canvas 再截 |
| 导出音频 | Web Audio API 按场景时钟切片对齐口播 |
| 工程磁盘 | File System Access API（目录句柄存 IndexedDB）；Tauri 用原生对话框 + 文件系统 |
| 口播缓存 | IndexedDB（`web2video-audio`） |
| 桌面 | Tauri 2：WebView + Rust 代理翻译/TTS，打包后不依赖 Vite |

### 工程模型

`src/types.ts` 里的 `Project` 是唯一真相：画幅、字体、字幕/进度条样式、导出规格、场景列表。

- `drive`：`narration`（默认，列表即时钟，可加延时行）或 `config`（播放元件排期）
- `speaks`：本场口播（id、多语言文本、角色）；时长只读，来自合成 `beatMs` 或字数估计；延时为 `kind: "gap"`
- `slots`：画面文案（含列表、对话窗）
- `cues`：旧入场绑定（无 `effects` 时仍可读）
- `blocks`：元件几何、样式、多条 `effects`；`TimeRef.kind` 为 `speak` / `scene` / `fixed`，终点也可只用 `durationMs`；`play` 元件只排期口播
- `audioByLang`：各语言配音元数据（时长、`beatMs`、是否过期）

时间轴在 `src/lib/timeline.ts` + `calendar.ts`：口播驱动按 `speaks` 列表（含延时）+ 停留；配置驱动按播放元件与动效窗口，全部结束后切场。换语言用各句实际时长，不再把画面按 0–1 拉伸。工作区底部进度条是全片一条，可点各场分段。

### 配音

合成入口 `src/lib/synthProject.ts`：按句合成后写入 `beatMs`。口播驱动按列表拼接（延时插入静音）；配置驱动按播放元件开始时刻混音。

浏览器不能直连 DashScope，开发服务器插件把请求转到 `/__tts/qwen`、`/__tts/qwen-voice`。API Key 在请求头里带上，存在 `web2video.tts-secrets`。音色库在 `web2video.voice-library`，可跨工程复用。配音窗口四个标签：合成、AI 配置、配音角色、音色管理（设计 / 复刻 / 从千问同步 / 试听）。

### 分镜 AI

工作台内 DeepSeek 等与 Cursor MCP 共用 `src/lib/ai/tools.ts`。链路与工具表见 [MCP](#mcp)。密钥在 `web2video.llm-secrets`；跨域 `/__llm/chat`。不要让模型处理密钥、翻译、配音合成。

### 导出

隐藏的 `#export-stage` 按画幅像素渲染。`src/lib/exportVideo.ts` 用 `html-to-image` 按帧率截图画到 canvas，`MediaRecorder` 混入按 `sceneClock` 切片的 TTS。规格在 `exportSettings`（格式、1080/720/480、帧率、音视频码率）。

字幕文件由 `src/lib/subtitles.ts` 把各场口播 beat 映射到全片时间轴，写成 SRT 或 VTT。烧录字幕条是舞台上的 DOM，字体用工程的 `captionFontId`（SIL OFL），与字幕文件独立。

### 目录结构（逻辑）

```
src/
  components/     顶栏、舞台、时间轴、检视、各对话框
  layouts/        舞台渲染 StageView
  lib/            时间轴、口播、TTS、导出、工程目录、AI
  lib/platform.ts Web / Tauri 分支
  store/          Zustand 编辑器
  types.ts        工程与版面类型
src-tauri/        桌面：文件系统 + 打包后的翻译/TTS 代理
mcp/              Cursor MCP：stdio 转到正在跑的编辑器
vite-plugin-*.ts  开发期 TTS / LLM / 翻译 / MCP 桥
```

## MCP

应用内 AI 与 Cursor MCP **共用** `src/lib/ai/tools.ts`（`AI_TOOLS` + `executeTool`）。`agent.ts` 把工具交给 Chat Completions。约定见 `SYSTEM_PROMPT`。

**应用内：** 顶栏「AI」配接口，右侧「AI」页对话，改当前工程。会话写在工程目录 `aisession.json`（打开文件夹恢复）。没有向量记忆，模型只带当前会话最近约 48 条消息。

**Cursor MCP：** 先 `npm run dev` 或 `tauri:dev` 打开编辑器（`http://127.0.0.1:5173`）。

| 层 | 文件 | 作用 |
| --- | --- | --- |
| 执行 | `src/lib/ai/tools.ts` | 工具 Schema 与对 Zustand 的读写 |
| 页面桥 | `src/lib/mcpBridge.ts` | 开发态连 `ws://主机/__mcp`，上报工具，执行 `call` |
| Vite 桥 | `vite-plugin-mcp-bridge.ts` | `GET /__mcp/health`、`GET /__mcp/tools`、`POST /__mcp/call` → WebSocket |
| stdio | `mcp/server.mjs` | MCP JSON-RPC（`initialize` / `tools/list` / `tools/call`），转发到上述 HTTP |
| Cursor | 仓库根 `.cursor/mcp.json` | `node web2video/mcp/server.mjs`，`WEB2VIDEO_MCP_URL` 默认 `http://127.0.0.1:5173` |

编辑器未开或页面未连上时，`/__mcp/call` 返回 503。调用改的是**正在编辑的工程**，不是磁盘上另一份。

| 工具 | 作用 |
| --- | --- |
| `get_project` | 片级概要、场景列表 |
| `get_scene` | 一场文案、口播、画面 visual i18n、元件、动效 TimeRef |
| `list_catalog` | 版面、元件（含 katex / three）、字体 |
| `set_project` | 画幅、字体、字幕/进度条、导出规格等 |
| `apply_storyboard` | 整片 replace / append |
| `update_scene` | 改一场（源语言画面 + 口播） |
| `manage_scenes` | 增删复制调序选中 |
| `manage_blocks` | 增删改元件；katex 写 `tex`，three 写 `threeSrc` |
| `set_visual_text` | 写画面文案某一语言（不是口播） |
| `set_cue` | 兼容旧入场窗口 |

公式用 `katex` 元件；三维用 `three` 元件且 `update({ t, localMs })` 跟播放头，不要 rAF，不要编造模型/贴图 URL。

## 快捷键

| 按键 | 作用 |
| --- | --- |
| 空格 | 播放 / 暂停 |
| Ctrl+S | 保存（选上级目录，写入「项目名」子文件夹） |
| Ctrl+E | 导出 |
| Ctrl+Z / Y | 撤销 / 重做 |
| ? | 帮助 |
