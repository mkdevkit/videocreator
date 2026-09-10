# Script2Video

口播脚本工作台：管脚本、管多语言口播、机翻、千问配音，再把画面事件绑在**节拍**上而不是绝对秒。同一套 UI 可跑在浏览器（Vite）或桌面（Tauri）。渲染可接 HyperFrames + GSAP、Remotion、Manim。

和 [`web2video`](../web2video) 的差别：那边是「网页场景编辑器」；这边是「脚本 / 节拍 / 引擎」管线。翻译、配音、密钥代理与 web2video 同一套（Edge 机翻 + 千问 TTS）。

## 怎么跑

**浏览器（开发）**

```bash
cd script2video
npm install
npm run dev
```

打开 http://localhost:5174 。必须用 `npm run dev`：本机 Vite 插件会代理千问 TTS、DeepSeek（LLM）和 Edge 翻译。

**桌面（Tauri）**

需本机已装 [Rust](https://rustup.rs/)（含 `cargo`）。

```bash
cd script2video
npm install
npm run tauri:dev     # 开发：嵌同一套前端
npm run tauri:build   # 安装包；可执行文件为 Script2Video.exe，图标来自 favicon
```

| | Web | Tauri |
| --- | --- | --- |
| UI | 同一套 React | 同一套 React |
| 翻译 / TTS / LLM 开发期 | Vite 插件 `/__edge_translate`、`/__tts/qwen`、`/__llm/chat` | 同样走 Vite（`tauri dev`） |
| 翻译 / TTS 打包后 | 仍需本机预览服务器，或以后接后端 | Rust 命令直连 Edge / DashScope |
| 工程文件 | 浏览器下载 JSON；可选目录 | 原生打开 / 保存 `project.json` + `script.json` + `aisession.json` + `media/` |

密钥只存在本机（`script2video.tts-secrets`、`script2video.llm-secrets`），不进工程文件。

## 字体

全部为 **SIL Open Font License**，免费可商用。字文件随工具打包（[Fontsource](https://fontsource.org/) 的 woff2），**不请求 Google Fonts**。离线导出也是同一套。自定义舞台 CSS 也不要写系统字体名。

| 用在哪 | 字体 | 许可 |
| --- | --- | --- |
| 工作台界面 | DM Sans、Noto Sans SC | SIL OFL |
| 默认舞台字体 | 外观 → 字体 → 默认舞台字体（缺省跟正文字体） | SIL OFL |
| 舞台正文 | 外观 → 字体 → 正文字体（默认 Noto Sans） | SIL OFL |
| 舞台标题 | 外观 → 字体 → 标题字体（默认 Noto Serif） | SIL OFL |
| 字幕条（预览与烧录）、节拍卡 | 外观 → 字体 → 字幕字体（默认 Noto Sans） | SIL OFL |
| 中日文缺字回落 | Noto Sans/Serif SC、JP；IBM Plex 日文走 IBM Plex Sans JP | SIL OFL |
| HyperFrames 示例页 | Noto Sans SC | SIL OFL |
| KaTeX 公式（脚本自行引入时） | KaTeX_* | SIL OFL |

成片可选字体（外观 → 字体里下拉，均为 SIL OFL）：Noto Sans / Noto Serif、Source Sans 3 / Source Serif 4、IBM Plex Sans、PT Sans、Nunito Sans、Inter、Literata、DM Sans。工作台「外观 → 字体」分「用在哪」「每种字体」两页表。禁止在舞台 CSS/HTML 写 Arial、微软雅黑、`system-ui`、`sans-serif`。

### 舞台外观是工程全局的

画幅、字体、底色、全局 CSS（`stageTheme` / `stageCss`）写在 `project.json`，**整片共用**。每个脚本自己的是舞台 HTML（`script.json` 的 DOM）和 GSAP。各脚本结构可以不同，但继承同一套变量：`var(--stage-base-font)`、`var(--stage-font)`、`var(--stage-title-font)`、`var(--stage-caption-font)`。

**默认舞台字体**打在舞台根节点上（`font-family` + `--stage-base-font`）。HTML/CSS 没写 `font-family` 的节点会整台继承它。某个节点写了自己的 `font-family`，或用了 `var(--stage-title-font)` / `var(--stage-font)`，就不再用默认这套。默认 CSS 里 `.title` 走标题字体、`.stat` 走正文字体，不走默认舞台字体。旧工程没有 `baseFontId` 时跟正文字体。

实现：`src/lib/stage.ts` 的 `mountStage` / `stageBoxStyle`（预览 `PreviewPane`、导出 `ExportStage` 会调）。下拉在顶栏「外观 → 字体」。预览和导出是同一条画面路径，和 Web2Video 的对照见仓库根 [README · 预览和导出](../README.md#预览和导出)。

## 用例

### 1. 用 AI 生成口播脚本（DeepSeek）

顶栏 **AI** 配置接口（默认 DeepSeek Flash / Pro，也可 OpenAI 兼容网关），再打开中间 **AI** 页用自然语言生成或改脚本。实现见下文 [MCP](#mcp)。

例如：「三句口播讲黑洞不是洞，GSAP 跟节拍走」。改完可切口播页改文案、脚本页改 timeline、右侧预览。

## 用例

### 2. 写一集口播，拆成节拍

新建脚本 → 按句加 beat（钩子 / 事实 / 收束）。每句各语言一份文案。画面事件不要写死秒数。在脚本里用口播 id：

```js
speech.s("hook")           // 这一句配音有多长（秒）
speech.holdS("hook", 0.48) // = s("hook") - 0.48：入场后还要停多久，直到这句说完
speech.startS("hook")      // 口播驱动：列表时钟上的起点
speech.play("hook")        // 脚本驱动：排期并返回起点
speech.sleepS(0.4)          // 口播驱动＝片尾；脚本驱动＝两次 play 之间
speech.totalS()            // 全片
```

入场用固定秒；**这一段代码的总时长 = `speech.s(id)`**。换语言只换 TTS，代码不用改。

舞台 HTML 写在**每个脚本**上（DOM，不是 canvas）。画幅在顶栏；字体、底色、全局 CSS 是工程级，在顶栏「外观」（见上文 [舞台外观是工程全局的](#舞台外观是工程全局的)）。烧录字幕条用「外观 → 字体 → 字幕字体」。每个脚本自己选引擎，导出按左侧列表顺序拼成一条片子。口播时长怎么取、各工具怎么写：工作台「用法」页，或下文 [工具用法](#工具用法)。

适合：科普、产品介绍、课程片头——同一套分镜要出很多语种。

### 3. 一键翻译空缺语言

源语言写完中文（或英语）→ 口播页九语言表 →「一键翻译空缺」或「全部重译」（Edge 机翻：中、英、日、法、德、俄、西、葡、意）。「翻译后合成语音」默认关闭。配音窗口可勾选要合成的语言。

### 4. 按语言生成口播，并对齐画面

顶栏「保存」后面的「配音」打开配音窗口，四个标签与 web2video 相同：

| 标签 | 做什么 |
| --- | --- |
| 合成 | 当前角色、各语言默认角色；勾选语言后合成当前脚本或全部脚本 |
| AI 配置 | 千问 API Key、地域、设计/复刻模型（存在 `script2video.tts-secrets`） |
| 配音角色 | 从本机音色库挂角色；口播表「角色」列可覆盖 |
| 音色管理 | 声音设计、声音复刻、从千问同步、试听；库在 `script2video.voice-library` |

按**当前脚本 × 所选语言**逐句合成（一句一条，得到真实 `beatMs`），再拼成整段音频。改了某句文案会标记该语言音频过期。口播时长只读，来自合成或字数估计。

入场用固定毫秒（各语言一样快）；停留跟该句口播拉长/缩短。不要整条时间轴 `timeScale`。

### 5. 切语言预览：同一套事件，不同时长

预览语言切到英语：`speech.s("hook")` 变短，标题 fade 仍是 0.48s，停留用 `holdS` 吃掉差额。右侧表列出每个口播 id 的秒数。

### 6. 导出视频与多语言字幕

顶栏「导出」：默认不烧录字幕条、不另存字幕文件，需要时在窗里勾选。

1. **每种语言各一段视频**：该语言配音 + 时间轴；可选烧录字幕条；可另存该语言 SRT/VTT（每条 cue 的起止 = 该句 `speech.s(id)`）。
2. **一段视频 + 多语言字幕**：只录视频语言；多种字幕文件**共用这段口播时间轴**，只换文案。勾选「附带视频语言」时，其它语言文件为两行双语、同一时间标记。

烧录字幕跟当前口播句对齐；字体在顶栏「外观 → 字体」的「字幕字体」；双语主行是配音语言，副行是第二语言。

### 7. 每个脚本一个引擎，导出按顺序合并

左侧列表顺序 = 成片顺序（可上移/下移）。每个脚本选一种引擎：

| 引擎 | 工作台里 | 成片这一段 |
| --- | --- | --- |
| GSAP | 本脚本 HTML + paused timeline，预览 seek | 本机录制舞台 |
| HyperFrames | 同上（框架 seek，不要 `play()`） | 本机录制舞台 |
| Remotion | 编辑构图草稿；预览为节拍卡 | 本机按口播时长录节拍卡；完整画面用 Remotion 渲该段再替换 |
| Manim | 编辑 Python 草稿；预览为节拍卡 | 本机按口播时长录节拍卡；完整画面用 Manim 渲该段再替换 |

时钟 JSON（`toClockJson`）仍是 Remotion / Manim 的时间轴：`durationInFrames` / `run_time` 来自口播，不要写死秒数。

### 8. 工程以目录为单位

和 web2video 一样：选一个上级目录，工程写在「项目名」子文件夹里。

- `project.json`：片级外观、语言、配音角色
- `script.json`：各脚本的口播、舞台 HTML、GSAP、画面文案
- `aisession.json`：工作台 AI 会话（打开工程即可恢复）
- `media/{lang}/{scriptId}.wav`：该句拼好的配音

打开时可选项目文件夹，或包含它的上级目录。Chrome / Edge 用目录选择器；没有该 API 时退回下载/打开 JSON（不含音频）。桌面（Tauri）同样选文件夹。Ctrl+S 保存到已绑定目录。换机器带上整个文件夹即可。

## 工具用法

工作台中间有「用法」页，与本节相同。画面跟口播节拍走，不要写死秒数。口播页给每句一个 id（如 `hook`）；脚本页选工具。

### 怎么取口播时长

| 层 | 存什么 | 随语言变吗 |
| --- | --- | --- |
| 语义 | 第几句、句内 0–1、元件 id | 否 |
| 口播 | TTS 每句真实毫秒（尚未配音时按字数估算） | 是 |
| 延时 | 口播表延时行，或脚本驱动的 `speech.play` / `sleepS` | 否 |
| 演出 | 入场 fade 等固定毫秒 | 否 |

每个脚本在口播页可选 **口播驱动** 或 **脚本驱动**：

- **口播驱动**（默认）：列表顺序即时钟。「加延时」插入只有时长的一行，合成时写入静音，后面的 `startS` 后移。
- **脚本驱动**：列表是台词库。必须 `speech.play("hook")` 才会出声；返回开始秒，可当 GSAP position。`sleepS` 插在两次 `play` 之间。

工作台注入的 `speech`（GSAP / HyperFrames）：

| API | 含义 |
| --- | --- |
| `speech.s("hook")` | 这一句配音有多长（秒）。这一段画面的总时长用它 |
| `speech.ms("hook")` | 同上，毫秒 |
| `speech.startS("hook")` | 这一句从哪一秒开始（口播驱动＝列表时钟；脚本驱动＝`play` 的位置） |
| `speech.endS("hook")` | 这一句哪一秒结束 |
| `speech.play("hook")` | 脚本驱动：排期并返回开始秒。口播驱动：等于 `startS` |
| `speech.holdS("hook", 0.48)` | `s("hook") − 0.48`。画面分两段：入场固定 0.48s（各语言相同）+ 停住到这句配音结束。换语言只变停住多久 |
| `speech.bodyS()` | 各句口播之和，不含延时 / sleepS |
| `speech.sleepS(0.4)` | 暂停。口播驱动加在片尾；脚本驱动推进 `play` 光标 |
| `speech.totalS()` | 本脚本全长 |
| `speech.text("hook")` | 当前预览语言的口播文案 |
| `speech.ids()` | 有文案的口播 id（不含延时行） |

入场用固定秒（各语言一样快）；**这一段总时长 = `speech.s(id)`**。多出来的时间用 hold 停住。右侧预览表列出每个 id 的秒数。

Remotion / Manim 不跑 `speech` 对象：用同一套时钟（`toClockJson` / `sceneDurationMs` / `audio.beatMs`）。

### GSAP

工作台默认引擎。每个脚本自己的舞台 HTML；画幅 / 字体 / 全局 CSS 在顶栏「外观」。本脚本只写 paused timeline。预览和导出走 seek，不要 `timeline.play()`。口播用 `speech.play`。

```js
const fade = 0.48;

timeline.fromTo(
  "#title",
  { opacity: 0, y: 16 },
  { opacity: 1, y: 0, duration: fade, ease: "power2.out" },
  speech.startS("hook"),
);
timeline.to(
  "#title",
  { duration: speech.holdS("hook", fade) },
  speech.startS("hook") + fade,
);

root.querySelector("#title").textContent = speech.text("hook");

const pauseA = speech.sleepS(0.25);
const pauseB = speech.sleepS(0.4);
timeline.to({}, { duration: pauseA }, speech.bodyS());
timeline.to({}, { duration: pauseB }, speech.bodyS() + pauseA);
```

### HyperFrames

和 GSAP 一样：每个脚本自己的舞台 HTML、同一套 `speech`。成片由 HyperFrames seek 这条暂停轴（`engines/hyperframes/bind-gsap.ts`）。构图时长 = `speech.totalS()`，随语言变。

```js
const fade = 0.48;
timeline.fromTo("#title", { opacity: 0 }, { opacity: 1, duration: fade }, speech.startS("hook"));
timeline.to("#title", { duration: speech.holdS("hook", fade) }, speech.startS("hook") + fade);
const pauseA = speech.sleepS(0.25);
const pauseB = speech.sleepS(0.4);
timeline.to({}, { duration: pauseA }, speech.bodyS());
timeline.to({}, { duration: pauseB }, speech.bodyS() + pauseA);
root.dataset.duration = String(speech.totalS());
```

### Remotion

工作台里预览/导出是节拍卡（时长与配音对齐）。完整画面拷到 Remotion 项目，用 `engines/remotion/NarratedScene.ts`。

`durationInFrames` 必须来自口播，不要写死 150。入场用固定帧数，多出来的口播帧用来停住。

```tsx
import { useCurrentFrame, useVideoConfig } from "remotion";
import { durationInFrames, remotionClock } from "./engines/remotion/NarratedScene";

// Root：durationInFrames={durationInFrames(script, audio, fps)}

const { fps } = useVideoConfig();
const frame = useCurrentFrame();
const { localMs } = remotionClock(script, audio, frame, fps);
const fadeS = 0.48;
const hookS = audio.beatMs.hook / 1000;
const pauseA = 0.25;
const pauseB = 0.4; // 与多次 speech.sleepS 相同；clock.sleep_ms 是合计
```

### Manim

工作台里同样是节拍卡。完整画面读 `toClockJson` 写出的 `clock.json`（`engines/manim/narrated_scene.py`）。`FadeIn` 固定 `run_time`，多余口播 `wait()`。每种语言一份时钟 + 一份配音。

```python
clock = load_clock()
beats = {b["id"]: b for b in clock["beats"]}
hook = beats["hook"]

fade = 0.48
hold = max(0.0, hook["ms"] / 1000 - fade)

self.play(FadeIn(title), run_time=fade)
self.wait(hold)
self.wait(0.25)  # 与 speech.sleepS(0.25) 对应，可多次
self.wait(0.4)
# clock["sleep_ms"] 是这些暂停的合计
```

### 不要做的

- 整条时间轴按「新时长 / 旧时长」做 `timeScale`
- CSS `animation-duration: 8s` 或 Remotion `durationInFrames={150}` 当口播时钟
- 用英文字幕时间轴驱动中文画面（字幕可以共用时间轴，**动画不行**）
- 调用 `timeline.play()`（预览和 HyperFrames 都是 seek 暂停轴）。口播用 `speech.play`
- 口播驱动下用 `sleepS` 做句间留白（它加在片尾）；句间静音用口播表「加延时」
- 脚本驱动下指望列表顺序自动播；必须 `speech.play(id)`

## MCP

Script2Video **没有** Cursor stdio MCP（没有 `mcp/server.mjs`，根目录 `.cursor/mcp.json` 只登记了 web2video）。工具只在工作台里跑。

实现与 web2video 应用内 AI 同构：`src/lib/ai/tools.ts` 定义 `AI_TOOLS` / `executeTool`，`agent.ts` 做 Chat Completions function calling，改当前 Zustand 工程。密钥在 `script2video.llm-secrets`；跨域走 Vite `/__llm/chat`。约定在 `SYSTEM_PROMPT`（口播驱动 / 脚本驱动、`speech.*`、不要写死秒数）。密钥、翻译、配音合成由用户在窗口里操作。工作台会话写在工程目录 `aisession.json`，打开文件夹恢复；没有向量记忆。

| 工具 | 作用 |
| --- | --- |
| `get_project` | 片级概要、脚本列表 |
| `get_script` | 一条脚本的 beats、引擎、源码摘要 |
| `list_catalog` | 引擎、用法、`speech.*` |
| `set_project` | 名称、画幅、字体、字幕等 |
| `apply_scripts` | 整片 replace / append |
| `update_script` | 改一条的文案、代码、引擎 |
| `manage_scripts` | 增删复制调序选中 |
| `manage_beats` | 改口播表（id、文案、角色、延时行） |
| `manage_stage_texts` | 舞台画面文案（sync / set_text），不是口播 |

口播时长只读。画面跟 `speech.s(id)` / `holdS` / `play`，不要 `timeScale`。KaTeX / Three.js 是 GSAP 脚本里的库，不是独立引擎。

若要让 Cursor 直接改脚本工程，需要像 web2video 那样加 Vite `/__mcp` 桥 + stdio 进程；目前未做。

## 目录

```
src/                 共用前端（Web + Tauri WebView）
  components/        脚本列表、口播、脚本、AI（DeepSeek）、用法、配音、预览
  lib/clock.ts       节拍 → 毫秒
  lib/engineGuide.ts 用法页 / 各引擎取时长说明
  lib/platform.ts    Web / Tauri 分支（文件、翻译、TTS）
  lib/ai/            工作台内工具（`tools.ts` / `agent.ts`），无 Cursor stdio MCP
src-tauri/           桌面：文件系统 + 打包后的翻译/TTS 代理
engines/hyperframes  HTML 合成 + GSAP
engines/remotion     Remotion 时钟适配
engines/manim        Manim 场景
```
