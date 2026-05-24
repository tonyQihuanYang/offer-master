# Staff Engineer Interview Prep — Courier Offer System (Just Eat Takeaway)

> 这是一份 Staff Engineer 面试备战包（JET · Courier Offer & Rewards · Canada）。
> 围绕两个 use case：UC1 快递员 Offer 系统现代化，UC2 实时欺诈检测团队指导。
> 题目原件见 `Staff Engineer - Interview Use Cases.pdf`。
>
> ⚠️ **准备阶段**：文档仍在迭代。内容确认后再做幻灯片 / PDF。

## 目录结构

```
.
├─ en/        英文文档（架构、决策、领导力答题、JD）
├─ zh/        中文文档（演讲大纲、运行时数据流、领导力中文版）
├─ adr/       决策记录 + RFC 骨架
├─ demo/      可运行的混合方案 POC（React + Express，SSE 事件驱动）
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
| [`job-description.md`](./en/job-description.md) | 招聘 JD + JD↔准备映射 |
| [`handOver.md`](./en/handOver.md) | 需向真实 repo 核实的开放项 |

## 🇨🇳 中文 — [`zh/`](./zh/)

| 文件 | 内容 |
|------|------|
| [`presentation-outline.md`](./zh/presentation-outline.md) | **主线** — 1 小时演讲大纲（逐张 slide + 时间分配 + JD 关键词）|
| [`runtime-dataflow.md`](./zh/runtime-dataflow.md) | 端上运行时数据流：冷启动 / offer 投递 / 模板更新（Mermaid 图）|
| [`fraud-detection-explained.md`](./zh/fraud-detection-explained.md) | UC2 学习笔记：Flink 运行时 + 欺诈检测端到端运作（中文）|
| [`flink-kafka-notes.md`](./zh/flink-kafka-notes.md) | Flink/Kafka 复习笔记（Q&A：UI/watermark/窗口/看数据/代码）|
| [`technical-leadership.zh.md`](./zh/technical-leadership.zh.md) | `technical-leadership.md` 中文版 |
| [`team-guidance-use-case-2.zh.md`](./zh/team-guidance-use-case-2.zh.md) | `team-guidance-use-case-2.md` 中文版 |

## 📐 决策工件 — [`adr/`](./adr/)

| 文件 | 内容 |
|------|------|
| [`ADR-001-hybrid-sdui.md`](./adr/ADR-001-hybrid-sdui.md) | UC1 决策记录（采用方案 C）|
| [`RFC-skeleton-fraud-detection.md`](./adr/RFC-skeleton-fraud-detection.md) | UC2 RFC 骨架 + reviewer 提问（演示"教而不替"）|

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

建议入口：先读 [`zh/presentation-outline.md`](./zh/presentation-outline.md)（决定整体结构），再按它引用的细节文档逐个核对。
