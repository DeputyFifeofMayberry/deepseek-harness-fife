---
description: "侧边栏底部面板：按服务商上报的用量估算当前会话花费，并显示 DeepSeek 账户余额。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-usage-panel

[English](README.md) | 中文

## 概述

使用 `dsh-client-ui-usage-panel`，无需离开对话即可随时看到花费和剩余额度。底部操作区与设置行上方的一行摘要显示当前会话的估算花费；展开后按模型路由列出花费并显示账户充值余额，余额不足时会给出充值入口。估算按模型目录公布的价目表对服务商上报的用量计价，并对每个请求所属时段应用高峰或低谷费率。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用此包

Web 应用 bundle 默认挂载此包；删除其 `ui-usage-panel` 行即可移除面板。它占用侧边栏公开的 [`sidebar.footer.panel`](../ui-sidebar/README.zh.md) 单占位槽，位于底部操作区和设置行之上。账户退出登录或状态未知时，面板不渲染。

宽侧边栏：32px 摘要行显示用量图标、本地化的“用量”、当前会话估算花费和展开箭头；余额不足时额外显示警示点。点击后在上方展开详情卡，按服务商/模型/推理强度列出花费并显示目录中的名称、充值余额、余额不足提示，以及 Platform 用量和充值链接。收起为 56px 轨道时只显示一个图标，提示气泡重复会话花费和余额，余额不足的警示点仍保留。

当前会话指主视图保留的会话。没有当前会话或尚无用量时，摘要显示“暂无用量”，详情只显示余额。面板通过共享的 `accountRead` 服务读取账户，并在展开详情时只重新读取充值钱包。

余额不足阈值按钱包币种由部署配置：

```yaml
- id: ui-usage-panel
  name: '@deepseek-ai/dsh-client-ui-usage-panel'
  config:
    lowBalance:
      USD: 1
      CNY: 10
```

没有配置阈值的币种永远不会被标记为余额不足。默认值为 1 USD 和 10 CNY。

<a id="understand-the-implementation"></a>
## 理解实现

[`dsh-token-meter`](../../llm/token-meter/README.zh.md) 的 `usageByRoute` 投影按服务商、模型、推理强度和 UTC 星期内小时提供上报用量。[`pricing.ts`](src/client/pricing.ts) 按每条路由的目录价目表逐桶计价：缓存未命中输入、输出以及可选的缓存命中与缓存写入费率，除以一百万 token。当 `ctx.pricePhase.at()` 判定该小时时段为低谷时，再乘以价目表的 `offPeakMultiplier`；公布的时间表每周重复，因此只需一个周一作为锚点。金额使用精确十进制运算并按币种汇总。没有公布价格的路由或缓存桶对应的 token 会作为“未定价 token”保留展示，而不会借用其他费率。

目录可用时以目录名称替换原始服务商/模型/推理强度 id；没有目录时原样显示 id。目录读取复用模型选择器所用的同一代 `ctx.modelDirectories.modelCatalog`，因此标签界面不会重复拉取目录。

此包不拥有 Host 服务、存储或计时器：`ctx.pricePhase.reading` 已在每个计费边界推进，`ctx.accountRead` 已跟随账户流，用量投影由 Host 计算。面板只在展开详情时重新读取余额。

<a id="model-experience"></a>
## 模型体验

无。此包是覆盖已记录用量和账户读取的浏览器端界面层，不注册任何面向模型的内容。

#### KV Cache effect

无；此包既不组装也不发送服务商请求。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与后续工作

- **不跟踪中国法定节假日。** 共享时段表会把公布的节假日时段视为高峰，因此这些工作日的估算可能偏高。偏差方向对读者可见，且不会隐藏花费。
- **这是估算，不是账单。** 它信任服务商上报的用量和目录公布的价格；中继、议价价格或目录未声明的服务商折扣不会反映。
- **只计算当前会话。** 其他已列出会话保留各自投影，但面板有意只跟随主视图会话，不汇总整个目录。
- **余额不足按各钱包本币比较。** 不应用汇率；未登录账户没有可比较的余额。
- **Platform 链接在新浏览器标签页打开。** 与 Desktop 的账户设置不同，面板没有原生内嵌页面通道，充值和用量会在外部打开。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作背景 — 点击展开</summary>

默认阈值大致相当于一次有实质内容的会话；需要自定义提醒水平的部署可在 `cordis.yml` 中覆盖。面板通过 `ctx.modelDirectories.modelCatalog` 读取目录，通过 `ctx.accountRead` 读取账户；两者都是已文档化的服务面，而不是特性插件之间的值导入。

</details>
