---
description: "侧栏底部角标，显示 DeepSeek API 计价当前处于高峰还是低谷时段。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-price-phase

[English](README.md) | 中文

## 摘要

当你希望工作节奏跟随 DeepSeek API 计价时使用 `dsh-client-ui-price-phase`：API 只在公布的高峰时段按峰值计价，其余时间（含周末与中国法定节假日）一律按半价低谷计费。本包在侧栏底部操作位挂载一枚安静的角标，一眼可读当前计价时段，悬停可看下一次时段翻转的时刻，且在显示侧栏的所有页面可见。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [已知限制与后续工作](#known-limitations-and-deferred-work)

-----

<a id="use-this-package"></a>
## 使用本包

Web 应用包默认挂载本包；移除其 `ui-price-phase` 行即移除角标。角标注册进侧栏公开的 [`sidebar.footer.action`](../ui-sidebar/README.zh.md) 列表，部署可以像任何底部操作位一样在其旁追加或替换占用者。角标不可交互：不打开任何面板，也不改变任何状态。

宽侧栏：一个小圆点加本地化时段词（"高峰" / "低谷"）。折叠栏：仅剩圆点。两种形态下悬停都会说明当前时段、按读者时区显示的下一次翻转时刻，以及公布的高峰时段定义。

<a id="understand-the-implementation"></a>
## 理解实现

[`src/client/price-phase.ts`](src/client/price-phase.ts) 中的 `pricePhase(at)` 用纯 UTC 运算按公布时刻表计算时段：高峰窗口为周一至周五的 UTC 01:00–04:00 与 06:00–10:00（[模型与定价](https://api-docs.deepseek.com/quick_start/pricing)）。读数附带 `nextBoundary`，即时段翻转的时刻；角标在该时刻只设置一个超时，而不是每秒轮询；可见性变化时重新设置超时，挂起的页签恢复后即可跟上。角标背后没有 Host 服务、存储或网络——时刻表是本包内的编译期常量，计价调整只需改 `PEAK_WINDOWS` 一行并同步文档。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与后续工作

- **不追踪中国法定节假日。** 公布时刻表将节假日全天视为低谷，但节假日日期每年公布，内置表格会无声过期。在这些日期的工作日高峰窗口内，角标可能显示"高峰"而实际计价为低谷——宁可高估成本，也不掩盖成本。角标提示中写明节假日规则，读者可自行消解歧义。
- 角标描述官方 DeepSeek API 的计价时刻表；经中转或自定义供应商路由的请求不按这些窗口计费，角标也不检查当前路由。
