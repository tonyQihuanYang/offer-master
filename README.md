# Staff Engineer Interview Prep — Courier Offer System (Just Eat Takeaway)

> 这是一份 Staff Engineer 面试备战包（JET · Courier Offer & Rewards · Canada）。
> 围绕两个 use case：UC1 快递员 Offer 系统现代化，UC2 实时欺诈检测团队指导。
> 题目原件见 `Staff Engineer - Interview Use Cases.pdf`。
>
> 📖 **Interviewer — start here:** [`Q&A.md`](./Q&A.md) (anticipated questions + answers + doc pointers) · [`en/`](./en/) (architecture, decisions, leadership) · [`adr/`](./adr/) (ADR-001 + RFC skeleton) · [`demo/`](./demo/) (runnable POC)
>
> 🎯 **作者自用**：[`INTERVIEW-CHECKLIST.md`](./INTERVIEW-CHECKLIST.md)（临场一页纸:标签页 / 节奏 / 金句 / 深水弹药 / 兜底）

## 目录结构

```
.
├─ en/             正式文档（架构、决策、领导力、JD、讲稿）
├─ adr/            决策记录 + RFC 骨架
├─ demo/           可运行的混合方案 POC（React + Express，SSE 事件驱动）
├─ slides/         Marp 幻灯片源
├─ study-notes/    学习/复习笔记 + 中文版本（作者备战用）
└─ Staff Engineer - Interview Use Cases.pdf   面试题原件
```

## 🇬🇧 English — [`en/`](./en/)

| 文件 | 内容 |
|------|------|
| [`courier-offer-system-architecture.md`](./en/courier-offer-system-architecture.md) | UC1 现状架构 + 约束 + 延迟预算（含 Mermaid 事件流）|
| [`approach-evaluation.md`](./en/approach-evaluation.md) | A vs B vs C 技术决策 + 行业佐证 + B/A vs C 辨析 Q&A |
| [`hybrid-end-to-end-design.md`](./en/hybrid-end-to-end-design.md) | 推荐方案 C 端到端设计 + payload 契约 + 迁移 + 指标 |
| [`app-version-compatibility.md`](./en/app-version-compatibility.md) | 老 app 兼容 / 版本协商 playbook |
| [`technical-leadership.md`](./en/technical-leadership.md) | UC1 技术领导力（推动移动团队决策）|
| [`team-guidance-use-case-2.md`](./en/team-guidance-use-case-2.md) | UC2 团队指导（全部 5 个考察点）|
| [`fraud-detection-explained.md`](./en/fraud-detection-explained.md) | UC2 学习笔记：Flink 运行时 + 欺诈检测端到端运作 |
| [`presentation-outline.md`](./en/presentation-outline.md) | **主线（英文版）** — 1 小时演讲大纲（逐张 slide + 时间 + JD 关键词）|
| [`presentation-script.md`](./en/presentation-script.md) | **逐字英文讲稿** — 照着念练口语（配 slides）|
| [`presentation-combined.md`](./en/presentation-combined.md) | **逐页对照**（每页：屏幕显示什么 + 你说什么）← 练习最直观 |
| [`job-description.md`](./en/job-description.md) | 招聘 JD + JD↔准备映射 |
| [`handOver.md`](./en/handOver.md) | 需向真实 repo 核实的开放项 |

## 📚 Study Notes — [`study-notes/`](./study-notes/)

> 作者备战阶段的中文学习/复习笔记 —— 非正式交付物,仅供参考。

| 文件 | 内容 |
|------|------|
| [`presentation-outline.md`](./study-notes/presentation-outline.md) | 1 小时演讲大纲（逐张 slide + 时间分配 + JD 关键词）|
| [`runtime-dataflow.md`](./study-notes/runtime-dataflow.md) | 端上运行时数据流：冷启动 / offer 投递 / 模板更新（Mermaid 图）|
| [`sticky-bucketing-explained.md`](./study-notes/sticky-bucketing-explained.md) | `hash(courierId+expId)%100<pct` 分桶讲透（为什么无状态也 sticky）|
| [`fraud-detection-explained.md`](./study-notes/fraud-detection-explained.md) | UC2 学习笔记：Flink 运行时 + 欺诈检测端到端运作 |
| [`flink-kafka-notes.md`](./study-notes/flink-kafka-notes.md) | Flink/Kafka 复习笔记（Q&A：UI/watermark/窗口/看数据/代码）|
| [`technical-leadership.zh.md`](./study-notes/technical-leadership.zh.md) | `en/technical-leadership.md` 中文版 |
| [`team-guidance-use-case-2.zh.md`](./study-notes/team-guidance-use-case-2.zh.md) | `en/team-guidance-use-case-2.md` 中文版 |

## 📐 决策工件 — [`adr/`](./adr/)

| 文件 | 内容 |
|------|------|
| [`ADR-001-hybrid-sdui.md`](./adr/ADR-001-hybrid-sdui.md) · [EN](./adr/ADR-001-hybrid-sdui.en.md) | UC1 决策记录（采用方案 C）|
| [`RFC-skeleton-fraud-detection.md`](./adr/RFC-skeleton-fraud-detection.md) · [EN](./adr/RFC-skeleton-fraud-detection.en.md) | UC2 RFC 骨架 + reviewer 提问（演示"教而不替"）|

## 🧪 Demo — [`demo/`](./demo/)

可运行的混合方案 POC：组件 registry + 粘性 A/B 分桶 + SSE 事件驱动推送 + 管理后台实时预览。
跑法见 [`demo/README.md`](./demo/README.md)。

## 🌊 Flink + Kafka 教学 Lab — [`flink-kafka-lab/`](./flink-kafka-lab/)

零依赖 Node 程序，把 Kafka/Flink 核心概念（分区、keyBy、keyed state、窗口、watermark、迟到事件）
做成可跑可改的代码，用 UC2 快递欺诈检测当例子。`node flink-kafka-lab/run.mjs`。
README 兼作 UC2 复习小抄。

## 🐳 真 Flink + Kafka (Docker) — [`flink-kafka-docker/`](./flink-kafka-docker/)

真·Apache Flink 集群 + Kafka，跑一个 SQL 欺诈检测作业，用来**亲眼看 Flink Web UI**
（作业图、并行度、checkpoint、背压、吞吐）。`cd flink-kafka-docker && docker compose up -d --build`，
然后开 `http://localhost:8081`。是 `flink-kafka-lab/` 那个教学模型的"真版"。

## 🎞️ Slides — [`slides/`](./slides/)

`slides/interview.md` — Marp 幻灯片源（开场 + UC1 + UC2）。
渲染：`npx @marp-team/marp-cli slides/interview.md -o slides/interview.html`（HTML/PDF 不入库）。

---

**Suggested reading path for the interviewer:** [`Q&A.md`](./Q&A.md) (TOC + anticipated questions) → [`adr/ADR-001-hybrid-sdui.en.md`](./adr/ADR-001-hybrid-sdui.en.md) (the decision) → [`en/hybrid-end-to-end-design.md`](./en/hybrid-end-to-end-design.md) (full design) → [`demo/README.md`](./demo/README.md) (to run the POC) → [`adr/RFC-skeleton-fraud-detection.en.md`](./adr/RFC-skeleton-fraud-detection.en.md) (UC2 RFC).
