# 🎯 面试前 Checklist(一页纸)

> JET Staff Engineer · 1 小时两个 case · 全程英文
> 配套:讲稿 [`en/presentation-script.md`](./en/presentation-script.md) · 幻灯片 `slides/interview.en.html`

## ⏱️ T-30min 准备
- [ ] 启动 demo:`cd demo && npm run dev`(**先跑着**,别现场启动)
- [ ] 开好标签页(见下);幻灯片 **F 全屏**测一遍
- [ ] 重生成最新幻灯片:`marp slides/interview.en.md --allow-local-files -o slides/interview.en.html`
- [ ] 水、纸笔、深呼吸

## 🗂️ 标签页(按用到顺序)
1. **slides/interview.en.html**(主屏,F 全屏)
2. demo **/client** · 3. **/admin** · 4. **/approaches**(端口看终端,5173/5174)
5. **ADR-001.en**(GitHub)· 6. **RFC-skeleton.en**(GitHub)
7. (备用)`approach-evaluation.md`

## 🧭 节奏(1 小时)
UC1 **~30min** → UC2 **~20min** → **全程欢迎提问**(别单口相声;分钟是上限)

## 🗣️ 开场第一句就埋 JD 词
> "My read on Staff is — drive decisions through **influence, not authority**, and be **hands-on: POCs, fail fast**. I'll answer both cases to that standard."

## 💎 背熟这 3 句(放慢、坚定)
1. **领导力**:*"My job isn't to win the architecture argument — it's to make the team that ships it a co-author. I'd rather ship B fully bought in than C quietly unhappy."*
2. **UC2**:*"My role is to make the team better at this, not do the work for them. If I do my job right, they handle the next streaming project without me having to come back."*
3. **收尾**:*"Both answered the same way — influence not authority, fail fast, hands-on POCs. That's my read on Staff."*

## ▶ 什么时候切标签页
- **Live POC 页** → /client 点 Dispatch · /admin 改+Save(绿 toast)· /approaches 看 A/B/C payload
- **UC1 决策/领导力讲完** → 闪 **ADR**
- **UC2 指导策略** → 展示 **RFC 骨架**("他们填、我批注")
- **被追问内部** → approach-evaluation

## 🎒 深水弹药(被问再放,别主动全铺)
- **A vs C**:线上是【字符串】vs【数值】+ 格式化在【中心】vs【边缘/手机】
- **B vs C**:谁拥有 layout —— mobile 应用逻辑(flag)vs server 发的数据
- **延迟长尾**:进程内+缓存、热路径零 I/O、fail-closed
- **老 app**:`min_app_version` + `fallback` + 未知组件静默跳过
- **Flink 该不该用**:题目没给量级 → 先测(~20/s 到几千/s,看是否算 GPS)→ right-size
- **180ms 优化**:攻 150ms 的 Temporal(并行/缓存/预计算),别动那 10ms

## ❓ 高频追问 → 一句话
| 追问 | 答 |
|------|----|
| 200ms 瓶颈? | 不是吞吐(556 RPS 很轻),是延迟预算;hybrid +10ms 仍在 SLA;上线前实测 |
| 3ms/10ms 怎么算的? | **预算不是测量**;热路径亚毫秒,预算含 cache-miss/GC 保险;上线前实测 |
| 为什么不纯 A? | 服务端渲染吃延迟、锁死原生 UX |
| 为什么不纯 B? | 每个 layout 实验都要发版、一致性难、老 app 不认新字段 |
| 粘性怎么保证? | 确定性 hash(courierId+expId)%100,不依赖缓存 |
| Flink 对不对? | 看量级,题目没给 → 先测、再选型;我帮团队自己得结论 |

## ⚠️ 别犯的错
- agenda **别剧透 C**(只说"评估 A vs B")
- demo **只点不改、绝不现场编译**
- 估算别当测量 →"这是预算,上线前会实测"
- 金句别快读;UC2 别炫"我自己跑过 Flink"(要"指导团队")

## 🆘 兜底
- demo 起不来 → Slide 9 有截图,照着讲
- pptx 打不开 → 直接用 **HTML 或 PDF** 放映(Keynote 读不了 marp 的 pptx)
- live 切不过去 → 口头提一句"我做了 POC / 写了 ADR / 给了 RFC 骨架"也拿分

---
**核心心法**:UC1 = 我能做架构和技术判断;UC2 = 我能放大团队、不替他们干。
**Staff = influence over authority · leverage over heroics · measure before deciding.**
