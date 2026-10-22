---
kind: upgrade-guide
description: "推理强度可以由强度策略按可验证性路由，且请求携带的强度若未被其路由声明，将按路由默认值分派而不是让轮次失败。"
---

# 推理强度按可验证性路由，选择会设置其基准

[English](guide.md) | 中文

## 变更

新增的 `effort-policy` 行按可验证性路由每个请求的 `reasoningEffort`：未发生验证失败时使用配置的基准，未解决的失败使其提升一档，同一检查通过后回到基准。它默认关闭，从不启用它的部署不会写入事件，也不会改变任何请求。

升级后调用方会看到三处变化：

- **`cordis.yml`。** `effort-policy` 接受 `enabled`、`baseLevel`、`verifiers`、`mutators`、`readOnlyCommands`、`ignoredArgumentKeys`、`infrastructureFailureCodes` 与 `shellTools`；`tool-subagent` 新增 `effortPolicy`（默认 `false`），它会在面向模型的工具上增加 `operation`、`verification` 与 `inherit_effort`，并要求同一组合中的 `effort-policy` 行已启用。`ignoredArgumentKeys` 默认为 `description`：这些参数在验证器匹配之前、在构建其标识之前被移除，因此调用方给同一个检查换个标题后，仍是在通过或失败同一个检查。
- **模型选择。** Web 选择器与 ACP 的 `reasoning_effort` 现在通过 `setBase` 把选择记录为策略的持久基准：等级名设置等级，其他任何被声明的强度原样写入且永不升级，提供方默认值为 `standard`。待生效的选择在请求确认其提供方与模型时退役，而不是在强度匹配时退役，因此策略选出的强度不会让选择一直处于待生效状态。
- **请求强度回退。** 请求携带的强度若未被绑定后的路由声明，现在会按路由默认值重新绑定并记录警告，而不是让轮次失败。无论是否启用策略，这一行为都生效。

在策略启用期间写入的会话包含必读的 `effort/decision` 事件，旧构建会拒绝打开它。此类会话不支持降级；禁用该特性可阻止产生新的此类会话。

## 迁移

1. 保持 `enabled: false` 即可维持今天的行为，无需其他步骤。
2. 若要启用路由，把 `effort-policy` 的 `config.enabled` 设为 `true` 并设置 `baseLevel`，在 `verifiers` 下列出可以提升强度的检查，并在每个委派行上把 `tool-subagent` 的 `config.effortPolicy` 设为 `true`。只切换两个委派行中的一个属于显式配置错误，而不是静默分歧。patch 会替换整行 config，不会深入 agent preset，因此把委派行挂在某个 preset 内的组合（Web 与 Desktop 应用即是如此）需要用 profile patch 重述该 preset 的 `config.plugins` 并加上该标志。
3. 重启进程并确认迁移生效：发送一次提示词，确认失败的已配置验证器记录 `effort/decision` 并提升下一个请求的 `reasoningEffort`，而同一检查通过后回到基准。
4. 若要回滚，同时把 `effort-policy` 的 `config.enabled` 设为 `false` 并把每个 `tool-subagent` 的 `config.effortPolicy` 设为 `false`。请求回到今天的行为；已写入 `effort/decision` 的会话仍可被本版本读取。
