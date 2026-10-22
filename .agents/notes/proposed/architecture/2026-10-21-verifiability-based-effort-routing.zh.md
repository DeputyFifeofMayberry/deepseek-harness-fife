# Agent Note: Verifiability-based effort routing

Status: proposed

[English](2026-10-21-verifiability-based-effort-routing.md) | 中文

## 问题

推理强度是 Agent 的属性，而不是工作的属性。`ModelSelection` 一次性固定 `{provider, model, reasoningEffort}`，`installModelSelection` 把它写入每个请求，而记录下来的 `request/header` 又以自身为后续请求播种。新会话继承不指定强度的 `agent-default-model`，于是 DeepSeek 适配器为每个轮次的每个步骤都提供自己配置的默认值 `high`。

直接调用 `ctx.llm.stream()` 的调用方完全不继承会话的强度：除非调用点自己指定，否则它们拿到的是模型的 `defaultEffort`。会话标题指定模型的最低强度；压缩（compaction）不指定任何强度，因此一个重放整段对话的摘要请求会以 `high` 运行，与用户选了什么无关。未来的每个辅助请求同样如此，除非其作者记得固定一个强度。

委派把同一个错误放大重演。未显式指定强度而创建的子级会继承父级 `AgentOptions` 上携带的强度，于是一个为从某次失败测试中恢复而升档的父级，会把同样昂贵的设置交给之后的每次委派。调研、实现和评审全都从父级恰好所在的档位开始，而且没有任何记录说明子级被要求做的是其中哪一件。

结果是 harness 把最昂贵的思考花在影响最小的工作上，而且没有任何持久记录解释某个请求为何使用了它所用的档位。产品要求是按可验证性而不是感知到的难度来路由：结果能被解析器、schema、测试或精确比较检查的工作可以便宜地运行；需要判断的工作则不行。

## 提案

### 三条车道

路由依据是操作本身的种类，而不是对用户话语的分类。发出请求的代码已经为每项操作命名，因此 harness 早已知晓它的身份。靠提示词文本猜测的分类器既要为自己的推理付费，又可能错在昂贵的那一侧。

**确定性：不用模型。** 任何有确切答案的事情都保持为工具调用：测试、类型检查、git、glob、grep、正则、token 计数、排序、hash 比较。本条车道不提出任何运行时组件；它是一条构建规则：从结构化输入计算值的新 harness 功能以函数形式发布，而模型调用必须在评审中证明自己的必要。现有 tier-0 工具已经覆盖本 Note 所要应对的那张表中的大部分内容。

**机械性：固定为低档。** 有名字的辅助操作在调用点指定自己的强度，而不是继承。今天唯一产品可达的情形是压缩摘要：会话标题已经固定自己的强度，其余直接 `ctx.llm.stream()` 调用方是没有任何已发布组合包会挂载的实验包。标题取 `efforts[0]`，在 DeepSeek 路由上即 `off`，比本条车道所需的更强。压缩改为解析 `low` 档，因为关闭思考去浓缩整段对话是一个质量赌注，本 Note 不做这个赌注。每处固定都是局部的、可单独回退的，并且可以通过读取记录下来的辅助请求来核实。

**推理：会话级。** 对话循环持有一个强度档位，详见下文。

### 强度档位

三个档位把策略与任何单一提供方的词汇解耦：

- `low`：模型声明支持 `low` 时取 `low`，否则取已声明的最低且不为 `off` 的强度，再否则取 `off`。
- `standard`：模型自身的 `defaultEffort`，也就是当前部署得到的行为。
- `deep`：声明支持 `max` 时取 `max`，否则取已声明的最高强度。

映射针对确切路由、在请求将要分派到的那次适配器注册上通过 `ctx.llm.resolveModelInfo()` 解析。它按请求解析而不缓存：推理元数据派生自实时连接设置，而模型设置页的一次编辑就会替换这些设置；没有失效机制的缓存会静默固定一个该路由已不再接受的强度。完全不声明推理的路由保持原样，因为运行时会对此类路由在提供方 I/O 之前拒绝任何显式强度。当解析出的强度等于模型的 `defaultEffort` 时，策略不写入任何内容：默认得到的强度与显式写入的强度是两种不同的持久 header 事实，而写入适配器本来会选的值只会改变记录，不改变行为。

### 循环策略

新插件 `@deepseek-ai/dsh-effort-policy` 负责每个 Agent 的强度档位。

- 它以 `prepend: true` 监听 `agent/request`，等待 `next()` 使模型选择已完成路由应用，然后只替换 `reasoningEffort`。提供方和模型绝不更改：更换路由会让前缀缓存复用失效，并因一次强度决策而记录一条模型切换通知。
- 基准档位来自 `Config`，在已发布组合中默认为 `standard`，因此不会改变任何已录制会话；本 fork 的 profile patch 选择 `low`。替每个部署做无声的行为变更不属于本 Note 的权限，而已录制会话语料正是当前行为的字面陈述。
- 策略是唯一的写入方，它显式获知用户的选择，而不是去推断。从请求中读取意图并不可靠：`agent/request` 用最近一次记录的 header 为第一个步骤之后的每个步骤播种，因此它看到的强度通常就是策略自己上一次的写入，而 Web 选择器又把这个相同的 header 投影回来。因此选择器的选择命令改为调用策略上的公共方法 `setBase(agent, level)`，并把该选择作为会话事实持久化；策略同时记录它为每个 Agent 应用的强度，于是自身写入的回声永不会被当作新的选择。消费方是会话控制器的选择命令与 ACP（Agent Client Protocol）控制面。
- 模式固定需要从模式所有者读取一项状态：plan 模式是真正要紧的情形，它的活跃状态目前是私有的（`loggedActive`）。该变更在那里新增一个只读访问器，或读取已发布的 plan 投影，策略通过可选查找消费它，使没有 plan 模式的部署保持基准档位。活跃的 Goal Round 以同样方式固定为 `standard`。

### 委派

子级的强度由委派的操作决定，而不是从父级当前档位继承。

委派工具新增可选字段 `operation`，默认 `general`：

| `operation` | 起始档位 | 最低档位 |
|---|---|---|
| `general` | `standard` | `standard` |
| `explore` | `standard` | `standard` |
| `implement` | `standard` | `standard` |
| `plan` | `deep` | `deep` |
| `review` | `deep` | `deep` |
| `mechanical` | `low` | `low` |

- `mechanical` 是获得廉价子级的唯一途径，它要求声明一个 `verification`，指名判定工作是否正确的检查，即子级会真正执行、以其成功或失败为准的命令。没有该声明的委派会在子级存在之前被拒绝，因为“这很简单”不是证据，策略也没有其他办法判断。
- 显式的 `reasoning_effort` 在操作最低档位之上具有权威性。若取值是三档等级之一且低于最低档位，请求会被拒绝，并在错误中指明该最低档位；它绝不会被静默提高，因为静默提高会掩盖一个要求了该操作禁止之事的调用方。其他被路由声明的强度则是调用方的确切选择：由适配器校验，策略把它原样写为子级的起始强度。
- 父级的当前档位永不继承。想要它的子级必须用 `inherit_effort: true` 显式请求，该项默认关闭。因此暂时处于 `deep` 的父级不会让之后的每次委派都变得昂贵。
- 工具通过可合并扩展的字段，把解析出的操作与继承选择记录在子级的 `AgentOptions` 上。策略读取该意图，而不是从提示词重新推导；由任何其他路径创建的子级没有操作，因此从配置的基准等级开始。
- fork 子级为复用前缀缓存而保留父级的提供方和模型，但仍从各自操作的档位开始；强度是请求控制项，不属于被缓存的提示词前缀。
- 每个子级都有自己的证据与恢复状态。其结果通过既有的委派结果送达父级。子级的失败本身绝不改变父级的档位：父级只依据自己失败的验证升档。

### 证据与恢复

升档只回答一个问题：这次失败是否属于更多思考能够修复的失败？

- **基础设施失败不升档。** 认证、配额、限流、超时、网络失败、取消和提供方过载都是恢复问题。取消无论部署如何配置都始终属于基础设施，因为被停止的检查证明不了任何事情。其他错误码只有在部署把它列入经过校验的 `Config` 失败类别时才成为基础设施：对于以错误标志为结论的验证器，错误标志本身就是结论，因此未列入的错误码会升档，由运维补充列表。文本验证器的错误则属于基础设施，因为检查并未运行。
- **验证失败升档。** 验证器需要显式配置，即一个工具名加上读取其结果的谓词。构建、测试、类型检查或 lint 运行以非零状态退出会升档；抛出错误、被拒绝或超时的工具则不会。把每个不愉快的工具结果都当作推理失败，会把一次不稳定的网络变成永久昂贵的会话。
- **提升后的强度持续到恢复得到验证。** 策略记录失败检查的身份，而不只是失败这件事。当同一个检查成功时，或用户通过 `setBase` 设定档位时，档位回到基准。轮次边界不会降低它，因为新的轮次并不证明先前的工作已被修复。
- **恢复是唯一的自动退出途径。** 如果失败的检查不再运行，会话可能在此后的整个生命周期内保持提升状态。这是有意的：未解决的失败不能证明下一步很容易。

### 记录与可见性

实际生效的强度已经进入持久的 `request/header`，因此不引入新的模型可见输入。策略新增一个仅用于日志的 `effort/decision` 会话事件，携带所选档位与解析出的强度、做出该选择的规则、先前的值、适用时的操作，以及提高或清除它的证据身份。正是该事件使策略可审计：每个廉价步骤都可追溯到一条规则，每个昂贵步骤都可追溯到一个具名失败，每个它拒绝采取行动的基础设施失败也同样可追溯。

现有模型选择器仍是手动覆盖入口，它改变基准而不是与策略对抗：选择某个强度时，它会映射到最近的档位并调用 `setBase`，因此两个最便宜的设置不会被某条下限规则静默忽略。在禁用思考的部署中选择 `off`，适配器只发布 `off`，策略遵从它。

### 可移植核心

策略是按可迁移来写的。决策逻辑住在一个无依赖的模块里，它接收纯数据（操作、该路由支持的强度与默认强度、已排队的证据、用户选定的档位），返回一个决策：一个强度，或不做更改，再加上产生该决策的规则。它不导入任何 Cordis、会话或 LLM 类型，也不读取配置、环境或时钟。

Cordis 插件是该核心之上的一个适配器：它把 agent 与工具事件映射为证据，通过 `ctx.llm.resolveModelInfo()` 解析模型能力，并写入请求。Mayberry 会在同一核心之上提供自己的适配器，而不是再写一份规则副本。词汇（三个档位、六种操作、基础设施与验证之分）属于核心，因此两个 harness 的路由方式完全一致。

## 计划

### 顺序

以下每个里程碑都在各自可评审的变更中落地。M0 与 M1 一起发布，因为没有产品使用的包无法通过 `verify-product-use`；在 M1 存在之前，M0 仍可独立测试。

| 顺序 | 里程碑 | 依赖 | 合并后的运行时影响 |
|---|---|---|---|
| 1 | M0 可移植核心 | — | 无 |
| 2 | M1 适配器插件，组合为禁用 | M0 | 无（服务已注册，无监听器） |
| 3 | M2 压缩固定 | M1 | 在 `enabled` 之前无 |
| 4 | M3 循环策略 | M1 | 在 `enabled` 之前无 |
| 5 | M4 委派字段 | M1、M3 | 在 `enabled` 之前无 |
| 6 | M5 手动选择 | M3 | 在 `enabled` 之前无 |
| 7 | M6 启用 fork | M2–M5 | 本 fork 的默认值改变 |
| 8 | M7 Mayberry 接管 | M6 + Mayberry 发布 | 本仓库无 |

M2 与 M3 彼此独立，可以任意顺序落地，也可以并行。

### M0 — 可移植决策核心

创建 `packages/llm/effort-policy/`：

- `package.json`：`@deepseek-ai/dsh-effort-policy`，导出 `"."`（适配器，在 M1 加入）与 `"./core"`（纯逻辑），标准 `files` 列表，`@deepseek-ai/cordis` 置于 peer 与 dev，`@deepseek-ai/schemastery` 置于 dependencies。
- `src/types.ts`：纯数据，包含 `EffortLevel`、`DelegationOperation`、`EffortCapability { efforts: readonly string[]; defaultEffort?: string }`、`Evidence`、`Decision`、`DecisionRule`、`EFFORT_POLICY_PROTOCOL_VERSION = 1`。
- `src/levels.ts`：`resolveLevelEffort(capability, level): string | undefined`，实现三条档位规则，并在路由不声明推理时返回 `undefined`。
- `src/policy.ts`：`decide(input): Decision`，作用于 `{ operation, capability, base, evidence, revision, minimum }`。
- `README.md`：包门禁要求的模型体验与限制章节。
- `tests/levels.spec.ts`、`tests/policy.spec.ts`、`tests/import-boundary.spec.ts`。

同时修改：`tsconfig.host.json`（项目引用）、`tsconfig.base.json`（经 `pnpm run gen-tsconfig-paths` 生成的别名）、`packages/llm/README.md`（分组表行）。

导入边界测试以文本方式读取 `levels.ts`、`policy.ts` 和 `types.ts`，断言其中不含 `@deepseek-ai/`、`node:` 或 `@mayberry/` 导入，也不引用 `Context`、`Session` 或 `Date`。该测试是可移植性守卫，没有别的东西强制执行它。

完成标准：`pnpm vitest run packages/llm/effort-policy` 通过，导入测试在一次探针导入上失败，且 `pnpm run typecheck` 干净。

### M1 — 适配器插件以禁用状态组合

在同一包中新增：

- `src/config.ts`：经过校验的 `Config`，包含 `enabled`（默认 `false`）、`baseLevel`（默认 `'standard'`）、`verifiers`（工具名加上判定通过或失败的结果谓词）、`mutators`（结果会改变工作区的工具名）、`infrastructureFailureCodes`、`escalationOrder`。
- `src/service.ts`：`ctx.effortPolicy` 上的 `EffortPolicyService`，暴露 `enabled`、`levelFor(operation)`、`setBase(agent, level)` 和 `capabilityFor(provider, model)`。
- `src/index.ts`：插件本身，注册该服务，并在 `enabled` 为 false 时不订阅任何内容。
- `tests/loader-composition.spec.ts` 以及 `tests/fixtures/cordis.yml`。

修改：

- `packages/bundle/base/cordis.patch.yml`：一行，`id: effort-policy`、`name: '@deepseek-ai/dsh-effort-policy'`、`config: { enabled: false }`。
- `packages/bundle/base/package.json`：`verify-cordis-config` 对组合中裸插件名所要求的依赖。
- `scripts/gen-cordis-catalog.ts`：`ctx.effortPolicy` 的 `SERVICE_PAGE` 条目。

重新生成：`docs/config-catalog.md`、`docs/module-graph.md`、`docs/event-producer-consumer.md`、LLM 子系统页面的生成区域、`packages/extensions/tool-cordis/src/api-catalog.ts`。

完成标准：`pnpm run doc-sync` 通过，`pnpm run test:snapshot` 无变化，`dsh --profile headless --dump-config` 显示该行且 `enabled: false`，并且在 loader 测试中禁用的插件不产生任何请求变化。

### M2 — 压缩固定

修改 `packages/compaction/compaction-basic/`：

- `src/summarizer.ts`：把裸的 `ctx.llm.stream(options)` 调用替换为 `ctx.llm.prepareCall(config, signal, (controls, model) => …)`，仅当 `ctx.get('effortPolicy')?.enabled` 为 true 时通过 `resolveLevelEffort` 解析 `low` 档。当策略不存在、被禁用，或路由不声明推理时，配置回调原样返回 controls。
- `package.json`：对 `@deepseek-ai/dsh-effort-policy` 的依赖。
- `README.md`：说明摘要的强度行为。

这与 `packages/session/session-title-llm/src/index.ts:252-258` 中的模式一致，该处已经从 `prepareCall` 的模型元数据解析强度。

完成标准：策略启用时，摘要请求记录 `low`；禁用时，该请求与今天逐字节相同；已录制会话无变化，因为没有已提交场景执行压缩。

### M3 — 循环策略

新增：

- `src/evidence.ts`：按 Agent 的证据存储，以 `{ verifier, command, workingDirectory }` 为键，跟踪最近一次变更结果的修订与每次观察的会话序列号。
- `src/index.ts`：监听器，包括 `agent/request`（`prepend: true`、等待 `next()`、只替换 `reasoningEffort`）、`tools/result`（记录验证、变更与基础设施证据）、`agent/request-error`（分类失败，绝不在基础设施上升档），以及通过 `declare module '@deepseek-ai/dsh-session/types'` 声明的 `effort/decision` 会话事件。
- `tests/evidence.spec.ts`、`tests/loop-policy.spec.ts`。

决策事件仅用于日志，携带 `{ protocolVersion, level, effort?, rule, previous?, operation?, evidence? }`。它不引入模型可见输入，也不引入第二套通知机制。

完成标准：档位、升档、恢复与基础设施分类的验收标准在单元测试中通过，且一个已录制场景固定一串 header 序列及其决策事件。

### M4 — 委派

修改：

- `packages/subagent/tool-subagent/src/index.ts`：仅当 `ctx.get('effortPolicy')?.enabled` 为真时，把 `operation`、`verification` 和 `inherit_effort` 加入工具输入 schema；为 `mechanical` 校验 `verification` 是否存在，为显式 `reasoning_effort` 校验操作最低档位；拒绝时指明最低档位。按各提供方的措辞扩展面向模型的描述，两个变体都由测试固定。
- `packages/subagent/tool-subagent/src/model-selection.ts`：把解析出的继承选择传入 `preflightChildLlmRoute` 既有的 `inheritParentReasoningEffort` 参数，而不是硬编码 `true`。
- `packages/subagent/subagent/src/child-agent.ts`：`resolveChildAgentOptions` 新增 `inheritEffort` 参数（默认为 `true`，保留今天的行为），并在其为 false 时省略父级的 `reasoningEffort`。
- `packages/core/agent/src/runtime-types.ts`：预计无需改动，因为 `AgentOptions` 可合并扩展，且 `resolveChildAgentOptions` 会展开 `requested`，新字段随之传递。在 M4 的第一个测试中确认，而不是凭猜测编辑。

把可合并扩展的字段（`effortOperation`、`effortInherited`）声明在策略包中而不是核心中，使 subagent 工具依赖策略包的类型，而核心保持不含强度词汇。

进程外提供方（`subagent-dsh-sdk`、`subagent-acp`、`subagent-claude-code`、`subagent-codex`）按构造会丢弃这些新字段。因此它们的子级从各自运行时的默认值开始，在这里即 `standard`。记录这一点，而不是新增能力标志。

完成标准：委派验收标准通过，一个启用策略的场景在处于 `deep` 的父级下记录到处于 `standard` 的子级，且所有既有 subagent 测试在策略禁用时仍然通过。

### M5 — 手动选择

修改：

- `packages/api/session-controller/src/commands.ts`：在一次成功的模型选择之后，调用 `ctx.get('effortPolicy')?.setBase(agent, levelForEffort(effort))`。强度到档位的映射住在策略包中，不在控制器里。
- `packages/api/session-controller/src/agent.ts`：保持 `consumeSelection` 在 header 匹配时把一次选择退役；由策略应用的强度不是一次选择，因此待处理条目必须在命令自身的确认上退役。
- `packages/acp/acp/src/model-control.ts`：为 ACP 的 `reasoning_effort` 选项做同样的调用。
- `docs/upgrade-guide/<next-version>/effort-policy/guide.md`：行为变更、开关和选择语义。

不改动任何客户端包：选择器仍发送相同的选择命令，仍读取 header 中的强度。

完成标准：选择 `off` 后保持 `off`，选择 `high` 后经历升档与降档仍然保持，ACP 配置项可往返。

### M6 — 启用 fork

由本 fork 的 profile patch 承担，而不是本仓库已发布的组合：

```yaml
- id: effort-policy
  config:
    enabled: true
    baseLevel: low
    verifiers: [ … the workspace's build, typecheck, test, and lint commands … ]
    mutators: [ … the fs write and edit tools … ]
```

上游保持 `enabled: false`。fork 也可以直接编辑 `packages/bundle/base/cordis.patch.yml`，代价是每次上游同步都要处理合并冲突；更推荐 profile patch。

完成标准：真实会话首先记录 `low`，在一次故意破坏的类型检查上升档，并且只在该类型检查通过后才回到 `low`。

### M7 — Mayberry 接管

Mayberry 一侧，按以下顺序：

1. 发布 `@mayberry/effort-policy-core`，其中包含 `src/types.ts`、`src/levels.ts`、`src/policy.ts` 及其测试的副本，导出相同的名称与相同的 `EFFORT_POLICY_PROTOCOL_VERSION`。
2. 在该核心之上实现 Mayberry 适配器：映射它的请求事件、能力查找和证据来源，不复制任何规则。

DSH 一侧，在 Mayberry 包发布之后：

3. 把 `@deepseek-ai/dsh-effort-policy` 对 `./core` 的实现替换为对 `@mayberry/effort-policy-core` 的再导出，在同一次变更中删除三个本地文件及其测试，并保留 `./core` 导出路径，使现有消费方无需迁移。
4. 其他一概不删：`src/index.ts`、`src/config.ts` 和 `src/evidence.ts` 是 Cordis 适配器，留在这里。

不变量是任何时刻只有一份实现。绝不要把副本 vendor 到两个仓库中，也绝不要让 DSH 适配器重新实现核心已经决定的规则；一条不同的规则意味着协议版本升级。

### 证据关联

升档是关于某个特定修订上某个特定检查的断言。适配器为每次验证观察记录：工具名、精确参数、该调用所在的工作目录、该观察在其会话中的序号，以及该时刻的工作区变更修订。持久状态按会话区分，因此一个会话的通过无法清除另一个会话的失败；而修订按工作区计算，因为并发的子级会改动同一棵树。

- 失败会升档。
- 通过只有在以下条件全部成立时才清除：验证器三元组相同、会话序列号晚于失败、变更修订不早于通过时刻的最新变更、且其后没有同一验证器的失败。
- 在失败之前观察到、位于另一工作目录、来自另一 Agent，或来自不同命令的通过，会被记录为陈旧，不改变任何东西。
- 被后续变更作废且未重新运行的通过不构成恢复；在检查再次运行之前，升档保持。
- 基础设施失败从不升档，也从不清除。

### 兼容性与版本化

- `enabled: false` 是已发布的默认值。在它之下没有监听器运行，工具 schema 没有新字段，每个已录制会话回放不变。
- `inherit_effort` 按组合有两种有文档的语义：在禁用的策略下不存在（沿用今天的继承），在启用的策略下默认为 `false`。该字段只在策略启用时提供，因此没有模型能请求其部署未实现的语义。
- `operation` 省略时默认为 `general`，解析为 `standard`，即子级今天在不继承时得到的同一起始档位。
- `EFFORT_POLICY_PROTOCOL_VERSION` 为跨越核心边界的决策数据定版本。档位规则、操作最低档位或决策字段的变更都会递增它；适配器拒绝在其不认识的协议版本的核心上运行。
- `effort/decision` 事件是新增的，且仅用于日志。它不递增 `SESSION_FORMAT_VERSION`。它是必读事件而不是可忽略事件，因为只有未声明的 `plugin:` 记录才能携带可忽略标记；因此写入已启用会话的构建之前版本的构建会拒绝该会话，而从不启用策略的部署不写入任何记录。SDK 投影在 M3 重新生成。

### 测试

每个里程碑都会补充其表面所需的用例；以下这些无论如何都必需：

- 档位：完整词汇、没有 `low`、仅有 `off`、没有推理元数据、未知强度。
- 策略：基准档位、操作最低档位、高于与低于最低档位的显式覆盖、`setBase` 替换基准。
- 证据：失败升档；基础设施不升档；通过会清除；失败之前的通过不会；后续变更之前的通过不会；位于另一目录、来自另一 Agent 或来自另一命令的通过不会；未解决的失败使档位跨轮次边界保持提升。
- 委派：父子隔离（父级 `deep`，子级 `standard`）；`inherit_effort` 仅在为 true 时复制父级；`mechanical` 缺少 `verification` 被拒绝；显式覆盖在最低档位之上被尊重、低于则被拒绝；丢弃这些字段的提供方产出的子级处于 `standard`。
- 兼容性：策略禁用时，工具 schema 不变，`inherit_effort` 不存在，捕获的请求 header 逐字节相同。
- 可移植性：导入边界测试。
- 快照：一个启用策略的场景用于升档与恢复，一个用于委派；所有既有场景在策略禁用时不变。

### 门禁

每个里程碑使用覆盖该 diff 的最小集合：

```
pnpm vitest run packages/llm/effort-policy
pnpm vitest run packages/compaction/compaction-basic
pnpm vitest run packages/subagent/tool-subagent packages/subagent/subagent
pnpm run constraints
pnpm run typecheck
pnpm run lint
pnpm run doc-sync
pnpm run test:snapshot
pnpm run build:artifacts && pnpm run build:check
pnpm run hygiene
```

`pnpm run test:coverage` 在新包上于 M1 合并之前适用，因为逐文件覆盖率是 CI 门禁。

### 发布、回滚与迁移风险

- 回滚是一个开关。`enabled: false` 恢复所有行为，因为没有监听器运行，工具 schema 也失去那些字段。M2 的压缩固定读取同一个开关，因此随之回滚。
- 单独回退 M4 是安全的：子级回到今天的继承，活跃子级上的 `effortOperation` 字段被忽略。
- 单独回退 M5 是安全的：选择器不再调用 `setBase`，策略保持其配置的基准。
- 不存在数据迁移。新事件是新增的，也没有持久记录改变格式。
- 评审中值得关注的风险：工具 schema 的变更面向模型，必须在两个变体中固定；`effort/decision` 事件不得成为第二条通知路径；`verify-product-use` 与配置目录迫使基准行和服务页进入与 M1 相同的变更；引擎必须留在 `packages/core/agent-loop` 之外，因为循环不做它无法解释的决策。

### 本计划刻意不新增的内容

不改动客户端或 UI；除单个仅日志事件之外不新增事件总线；不做基于模型的分类；策略内部不加规则 DSL、插件钩子或配置 UI；不在 subagent 提供方之间加能力标志；不为 Mayberry 提供第二份规则实现。

## 备选方案

**在循环前面放一个 LLM 分类器。** 提案的流程以“对任务分类”开始。作为机制被否决：分类器本身就是一个模型请求，仍需为它选择强度；它的错误会落在最昂贵的一侧；而且它为每个轮次增加一次往返。操作身份已为构建请求的代码所知，分类只会重新推导 harness 已有的事实。

**把确定性提示词分类器当作路由权威。** 作为主要机制被否决，因为关键词启发式在不同语言和措辞下都很脆弱，而在推理任务上错误的 `low` 无法在同一个轮次内挽回。仅保留为可选的 `deep` 起始提示，这种选择偏向安全的方向。

**没有低基准的升档。** 否决，因为它让已测量的浪费原样保留：辅助请求和机械性轮次停留在 high，而后者是长会话中 token 账单的大部分。

**改模型而不是改强度。** 否决，因为更换路由会破坏前缀缓存复用，并因一个用户从未做出的决定而记录一条模型切换通知。

**从请求中读取用户的选择。** 否决，因为 `agent/request` 用最近一次记录的 header 为第一个步骤之后的每个步骤播种，因此请求上的强度通常就是策略自己上一次的写入，而 Web 选择器又把这个相同的 header 投影回来。从回声推断选择会让一次升档永久化，让选择器的待处理选择永远无法结算，也无法区分恢复会话继承的强度与一次新的选择。显式的 `setBase` 每个表面只付出一个调用点，并消除这种歧义。

**继承父级的强度档位。** 作为默认值被否决。继承实现起来便宜，却在常见情形下就是错的：委派之所以存在，是因为父级需要调研、实现或独立判断，而刚刚升档的父级是子级起始档位最糟糕的来源。可选加入的 `inherit_effort` 保留了这项能力，但不保留该默认值。

**在核心中按 `GenerateOptions.purpose` 路由。** 这很有吸引力，因为 `purpose` 已经区分 `compaction` 与 `session-title`。它被推迟而不是被否决：让核心依据一个日志字段路由，等于把策略放进循环，而循环不得获得它无法解释的决策。如果辅助调用点的数量增长到单点固定无法承载，再重新考虑。

## 验收标准

- 在本 fork 的 profile 选择 `low` 时，新会话以 `low`（或模型最低的非 `off` 强度）发送第一个请求，且记录下来的 `request/header` 显示这一点。
- 在已发布的 `standard` 基准下，已录制会话语料回放不变：没有 header 新增或失去显式强度，因为解析出的强度等于模型默认值时策略不写入任何内容。
- 压缩请求以 `low` 档运行，会话自身的档位不改变它。
- 验证失败会提高下一个请求的强度，记录一条指名该检查的 `effort/decision`，跨轮次边界保持提升，并且只在该检查成功时降低。
- 认证失败、限流、超时，以及抛出错误的工具，都保持档位不变，并在决策事件中说明这一点。
- 不声明推理元数据的路由保持原样，分派不报错。
- 来自选择器的 `setBase` 改变会话基准；选择 `off` 后保持 `off`；升档仍可高于一次选择，并且只在验证恢复后回落到它。
- 委派：没有 `operation` 时从 `standard` 开始；`plan` 与 `review` 从 `deep` 开始；缺少 `verification` 的 `mechanical` 被拒绝；带 `verification` 的 `mechanical` 从 `low` 开始；高于最低档位的显式 `reasoning_effort` 被尊重；低于最低档位的被拒绝并在错误中指明最低档位；复制父级档位需要 `inherit_effort`，处于 `deep` 的父级不会提高其 `general` 子级。
- 子级创建、继承选项、显式覆盖、独立升档、父子隔离和已录制会话兼容性各自都有回归测试。
- 决策核心有一个测试，断言它不从 harness 导入任何东西，且只针对纯数据编译。
- 一个已录制会话快照固定一个升档轮次的 header 序列与决策事件。

## 风险

- **低档优先可能无声地表现不佳。** 没有验证步骤的任务会得到一次廉价的尝试，而且没有机械信号表明它做得很糟。这是本 Note 的核心赌注：在编程 harness 中，多数失败会通过工具暴露出来，而升档捕获这些失败的时刻，比分类器阻止它们的时刻晚一个步骤。
- **以恢复为条件的降档可能让会话停留在高位。** 如果失败的检查不再运行，提升的档位永不回落。这比在轮次边界重置更可取，但它让一次未解决的失败在此后会话中一直昂贵。
- **升档分类器有时会出错。** 一个实际上是容量问题的提供方错误会被归类为基础设施而不升档；一个以干净的工具退出到达的真正糟糕结果也不会升档。决策事件是审计这些判断的唯一途径。
- **`operation` 字段面向模型，可能被错误标注。** 认为有界工作属于机械性的模型可以要求 `low`。强制的 `verification` 是缓解措施；它不会让这个标签变成真的，但会让谎话暴露出来。
- **确定性车道靠评审而不是代码执行。** 没有门禁执行的构建规则会逐渐侵蚀。如果它要紧，就需要在变更评审路径上有一条检查清单条目，而不是这里的散文。
- **无写入规则的一个例外会重录语料。** 已发布组合只有在策略不碰适配器默认强度时才保持逐字节一致。如果之后的某个档位或固定写入了一个等于默认值的显式强度，每个已录制会话都会改变，回放车道就需要一位持有真实 API 密钥的负责人重新录制，因为快照是所有者本地的。
- **请求路径上逐请求的模型查找。** 解析在每个请求上运行一次且不缓存；一个其适配器由权威远程目录支撑的部署，会把它变成每个步骤一次网络调用。
- **策略需要在选择路径上有消费方。** 只有会话控制器与 ACP 控制面都调用 `setBase`，它才是正确的；仍然直接写入 header 的表面会以设计无法检测的方式与策略对抗。
- **可移植核心会向它的第一个适配器漂移。** 核心一旦接收一个 Cordis 类型、一个会话 id 或一个时钟，Mayberry 就无法复用它。导入测试是守卫；测试看不见的一切，必须靠评审守住。
- **策略可能让没有要求它的用户感到意外。** 一个在出问题之前静默以 `low` 运行的会话，是用户没有选择过的行为变更。记录下来的决策事件和请求 header 中可见的强度是仅有的披露。
- **可见的强度会自行移动。** 模型选择器投影最新的请求 header，因此升档的会话会在步骤之间显示强度变化。这是诚实的，但它让手动选择看起来不稳定；客户端可能需要区分策略应用的强度与用户的选择。
