# Demo Video — Shot List / Script

> 目标：**60–90 秒**讲清这个 POC 的核心证明点，用于面试（录屏代替现场 demo，零翻车风险）。
> 旁白（Narration）用英文写好，可直接念或做字幕；操作步骤和备注用中文。
> 三段：① 服务端驱动 layout（不发版）② 粘性 A/B + 事件驱动推送 ③（可选）forward-compat。

---

## 录制前准备

| 项 | 设置 |
|----|------|
| 启动 | `cd demo && npm run dev`，等两个端口都起来 |
| 浏览器 | 干净窗口，隐藏书签栏；窗口 ~1280×800；缩放 100% |
| 标签页 | 开两个：`/admin` 和 `/client`（录的时候来回切，或并排）|
| 初始状态 | tenant 选 **CA**；client 的 courier 先填 `c123`、variant `auto` |
| 录制工具 | macOS 自带 `Cmd+Shift+5`（选区域录屏）即可；或用文末的 Playwright 自动录制 |
| 节奏 | 每个操作后停顿 ~1 秒让画面"落地"，方便剪辑 |

> 💡 录之前先在 `/admin` 把 CA 的 treatment 调成一个**和 control 明显不同**的样子并保存（比如 treatment 用 `earnings_total_v2` + `surge`），这样第二段切 courier 时对比才抢眼。

---

## 段落 ① — Server-driven layout, no app release（~30s）

| # | 操作 | 画面 | 旁白（念这句）| 时长 |
|---|------|------|---------------|------|
| 1 | 打开 `/admin`，tenant = CA | 三栏后台 + 右侧两台预览手机 | *"This is the ops console. The courier app ships once — everything here changes the offer with no app release."* | 5s |
| 2 | 点 **treatment** tab，拖动组件重排 / 把 `earnings_breakdown` 换成 `earnings_total_v2` | 右侧 treatment 手机**实时重绘** | *"I reorder components and swap to a v2 earnings card. The preview re-renders through the very same components the real app uses."* | 8s |
| 3 | earnings model 下拉切到 `surge`，hints 加 `highlight=surge` | 手机上出现 surge 样式 | *"Switch the earnings model, add a highlight hint."* | 6s |
| 4 | 点 **Save config** | 顶部弹出绿色 **✓ Config saved for CA** | *"Save — that's just a server config change. No build, no app store release."* | 5s |

**证明点**：layout / earnings model / hints 全是服务端配置，改完即生效，**前端不发版**。

---

## 段落 ② — Sticky A/B + event-driven push（~40s）

| # | 操作 | 画面 | 旁白 | 时长 |
|---|------|------|------|------|
| 5 | 切到 `/client`，CA，courier `c123`，variant `auto` | 连接灯变**绿**（SSE connected）| *"The courier app opens a live stream and just waits."* | 6s |
| 6 | 点 **⚡ Dispatch offer** | offer 被**推**进手机；inspector 显示 `bucket 95 / control` | *"Dispatch simulates a job event. The offer is pushed down the stream — not polled. This courier hashes into control."* | 10s |
| 7 | courier 改成 `c999`（流重连），再点 **⚡ Dispatch offer** | inspector 显示 `bucket 2 / treatment`，手机变成 treatment 的 v2 样式 | *"Different courier, same deterministic hash — lands in treatment. Same courier always gets the same variant, every offer."* | 12s |
| 8 | variant 切到 `control` / `treatment` 各 dispatch 一次；指向 event log | inspector `source: override`；event log 累积 | *"I can force a variant for QA — tagged 'override' so it's never confused with a real assignment."* | 8s |

**证明点**：① 同一 courier 永远同一组（粘性 hash）② offer 是**事件推送**进来的（event-driven，不是轮询）。

---

## 段落 ③（可选）— Forward-compat（~12s）

| # | 操作 | 画面 | 旁白 | 时长 |
|---|------|------|------|------|
| 9 | 回 `/admin`，给 layout 加一个**不存在的组件名**（如 `foo_widget`），Save | client 再 dispatch | 手机正常渲染，未知组件位置是**虚线占位**、不崩 | *"An unknown component is skipped silently — so the server can ship ahead of the app without breaking old versions."* | 12s |

**证明点**：未知组件静默跳过 = server 可领先 app 发布（老 app 安全）。

---

## 收尾旁白（录在最后 ~5s，配 client 手机画面）

> *"One running prototype: server-driven layout shipped without an app release, sticky A/B by deterministic hash, and offers pushed over an event stream — exactly the hybrid approach from the design."*

---

## 总时长 & 剪辑建议

- ①30s + ②40s + ③12s + 收尾5s ≈ **~85s**。想更短就砍段落 ③ 和步骤 8 → **~60s**。
- 剪辑时给"Save toast 弹出""offer 推进手机""bucket 数字变化"这三个瞬间各留一个**短停顿/放大**，它们是记忆点。
- 字幕直接用上面的英文旁白；如需双语，中文放下方小字。

---

## 附：自动录制（Playwright）

如果想要可重复、不手抖的版本，可以用 Playwright 自动跑这套流程并录成视频。
**这个环境里没有浏览器自动化 MCP，所以需要你在本地跑**（或让我先写好脚本你来执行）。大致：

```bash
cd demo
npm i -D @playwright/test
npx playwright install chromium
# 运行录制脚本（脚本待生成：demo/scripts/record-demo.mjs）
node scripts/record-demo.mjs   # 输出 demo/recordings/*.webm
```

Playwright 用 `context = browser.newContext({ recordVideo: { dir: 'recordings' } })` 录制，自动执行上面的点击序列。
需要的话告诉我，我把 `record-demo.mjs` 写出来。
