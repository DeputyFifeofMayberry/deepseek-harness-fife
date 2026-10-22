---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-10-21-effort-decision

[English](2026-10-21-effort-decision.md) | 中文

## 概述

新增仅记录用途的 effort/decision 会话事件，用于记录一次推理强度迁移：迁移后的持久基础等级、精确强度或未解决的验证失败，以及产生该迁移的规则。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

```yaml persistence-change
schemaVersion: 1
id: 2026-10-21-effort-decision
baseline: false
changes:
  - root: "event:effort/decision"
    previous: null
    after: "69d81cfb2452d110c8f47a8d5a8b1a98e4bcae78443a92b009a20e32160300d4"
    decision: same-version
```

<a id="compatibility"></a>
## 兼容性

属于追加事件，读取时视为必需。既有日志不含该事件，当前读取方不受影响。早于该成员的构建会拒绝打开在策略启用期间写入的会话；策略默认禁用，因此随包发布的会话不会包含该事件。

<a id="verification"></a>
## 验证

已重新生成持久化目录，事件出现在 known-event-types.ts 与 docs/persistence-schema.json 中。effort-policy 的单元与集成测试覆盖决策记录、升级、恢复、陈旧拒绝、禁用行为与会话恢复。

<a id="dev-note"></a>
## 开发备注

无。
