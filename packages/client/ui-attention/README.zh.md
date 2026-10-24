---
description: "向 Desktop 外壳上报已完成任务与待批准请求，用于原生后台提醒。"
kind: "package-reference"
---
# @deepseek-ai/dsh-client-ui-attention

[English](README.md) | 中文

## 概述

基于既有客户端事实的 Desktop 提醒上报。插件观察会话目录中 Host 列出会话的 `running` 状态迁移，并包装审批 Remote Event 瀑布，把 `task-complete`、`approval-request`、`approval-resolved` 上报给 Desktop 外壳；原生通知、抑制规则与文案均由外壳负责。在普通浏览器中，或缺少 Desktop 桥接的 `activity` 上报器时，本插件不做任何事。适用于 Desktop 窗口隐藏、最小化或失焦时需要原生提醒的场景。

## 目录

- [模型体验](#model-experience)
- [已知限制与暂缓事项](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

完成上报遵循会话级收敛：存在排队或链式回合的会话在其驱动收敛前保持安静；任何会话的首次观察只建立基线而不上报，因此启动、重连与目录替换不会伪造完成事件。仅作为目录回退出现的子代理行永不上报。审批上报只包装、不消费作用域瀑布：插件先于审批呈现器注册，在请求到达时上报一次，并在消费方的应答落定后上报解决。

<a id="model-experience"></a>

## 模型体验

无；本包只观察客户端侧会话状态，不注册任何面向模型的内容。

#### KV Cache effect

无；提醒上报不会改变模型请求。

## 已知限制与暂缓事项

<a id="known-limitations-and-deferred-work"></a>

- **呈现与策略由外壳负责** — 本包只上报事实；抑制规则、通知文案、设置与点击行为由 Desktop 外壳负责，系统专注模式仍可能抑制最终通知。


<a id="dev-note"></a>

### 开发备注

<details>
<summary>维护者的工作上下文 — 点击展开</summary>

无。

</details>
