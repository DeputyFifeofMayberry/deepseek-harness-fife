---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-10-23-delegated-subagent-usage

[English](2026-10-23-delegated-subagent-usage.md) | 中文

## 概述

新增仅写入日志的 `subagent/usage` 事件。委派方记录子执行周期产生的供应商用量，使对话的 token 与花费读数包含它委派出去的工作，而不只是它自身的请求。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

```yaml persistence-change
schemaVersion: 1
id: 2026-10-23-delegated-subagent-usage
baseline: false
changes:
  - root: "event:subagent/usage"
    previous: null
    after: "9f45f09ee552545e6a9841eed2c3acb44fdc89a1eea6831a63eafcc972d5f330"
    decision: same-version
```

<a id="compatibility"></a>
## 兼容性

在当前 Session 格式版本中新增根。既有日志不含该事件且保持有效；早于它的读取方会拒绝携带该事件的日志，这与它对每个读必懂事件的处理一致。只有 `dsh-subagent` 会在本地子执行周期结算时写入该记录，且它从不呈现给模型。token-meter 投影将其按路由的计数加入父会话的计费总量与按路由用量，同时不改动上下文压力和 `(turn, step)` 替换位，因此委派花费只计一次，也不会抬高父会话自身的上下文读数。

<a id="verification"></a>
## 验证

pnpm exec vitest run packages/subagent/subagent packages/llm/token-meter：876 个测试通过，1 个跳过。新增用例覆盖周期折叠（路由归属、按步替换、嵌套归属、零计数）、父会话写入、两个 token-meter 投影，以及 activation-policy 中“子运行只向父日志添加其目录条目和一条用量归属”的断言。

<a id="dev-note"></a>
## 开发备注

无。
