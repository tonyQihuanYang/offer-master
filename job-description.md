# Job Description — Staff Engineer, Courier Offer & Rewards (Just Eat Takeaway.com)

> 这是该职位的官方招聘信息。用于和面试题目（`Staff Engineer - Interview Use Cases.pdf`）及答题材料对照——
> 面试的两个 use case 精准对应 JD 的两根支柱。JD↔准备的映射见 `presentation-outline.md` 顶部的叙事主线与「硬问题速查表」。

---

## About the company

Just Eat Takeaway.com is a leading global online delivery platform; the vision is to empower everyday convenience. The tech platform connects tens of millions of customers with hundreds of thousands of restaurant, grocery and convenience partners across the globe.

## About this role

We are seeking a **Staff Engineer** to lead a highly visible and impactful engineering team within the **Courier Offer and Rewards Teams**. The team operates with a high degree of autonomy to identify, develop, and validate new business ideas and technologies — from high-risk moonshots to innovative concepts with the potential to drive future growth.

The Courier Offer and Rewards is responsible for a large number of tools and features in the app and in the Operational Tool to give everyone freedom to configure how couriers would be rewarded by their deliveries. The whole area has **about 55 developers and QEs** that you would be working closely with to help them in system designing solutions and drive them through technical decisions.

- **Location:** Canada
- **Reporting to:** Senior Technology Manager

## Key components to the position

- Take a leading role in the design of our **system architecture**, **third party integration planning**, and work in collaboration across multiple business stakeholders.
- Collaborate with other cross-functional engineers & engineering teams, as well as key stakeholders, to ensure we deliver exceptional user experiences.
- Develop and execute new innovative ideas, stay current with industry trends, and apply a **"fail fast"** approach.
- Work within a dynamic environment, balancing strategy and innovation. You will be **hands-on with POCs and rapid prototypes**.
- **Lead, coach, and develop** Engineering developers, providing technical direction and solution design.
- Drive **rapid prototyping**, influence stakeholders, align projects with JET goals, and make critical technical/strategic decisions for short-term experimentation and long-term scalability.
- Advocate for **top-tier technical excellence and quality ownership**.

## What will you bring to the team?

- Strong software engineering and architectural experience.
- A deep understanding of **event-driven architecture & distributed systems**.
- Experience working with **big data & near real-time data processing** problems.
- Proficiency in **cloud platforms** (AWS, Azure or GCP for example).
- Strong problem-solving skills.
- Experience of **guiding software engineering decisions via influence, rather than by authority**.
- Flexible & proactive with the ability to manage shifting priorities.
- Experience with mobile apps and managing distributed teams is beneficial but not essential.

---

## JD ↔ 准备材料映射（速查）

| JD 要求 | 对应 case / 文档 |
|---------|-----------------|
| event-driven & distributed systems | UC1 — `courier-offer-system-architecture.md`, `hybrid-end-to-end-design.md` |
| big data & near real-time data processing | UC2 — `team-guidance-use-case-2.md`（先证明懂流式，再下 right-sizing 结论） |
| **influence, not authority** | UC1#3 `technical-leadership.md` + UC2 `team-guidance-use-case-2.md`（全场主线） |
| **fail fast / hands-on POCs / rapid prototypes** | `demo/`（可运行 POC）+ UC1「proof not vote」+ UC2「3 天发 1 个 pattern」 |
| lead/coach/develop engineers（~55 人） | UC2 知识传递 30/60/90 |
| cloud platforms | UC1 — AWS（SQS / AppSync / Temporal） |
| third party integration planning | UC1 — Data Science 定价 / Courier Pay / Bonus 的集成 + 超时/重试 |
| mobile apps + distributed teams | UC1 移动团队协作；15 国分布式团队 |
