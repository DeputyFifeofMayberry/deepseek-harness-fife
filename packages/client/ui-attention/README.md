---
description: "Reports finished tasks and pending approvals to the Desktop shell for native background attention."
kind: "package-reference"
---
# @deepseek-ai/dsh-client-ui-attention

English | [中文](README.zh.md)

## Summary

Desktop attention reporting over existing client facts. The plugin observes the session catalog's `running` transitions for Host-listed sessions and wraps the approval Remote Event waterfall, forwarding `task-complete`, `approval-request`, and `approval-resolved` reports to the Desktop shell, which owns the native notifications, their suppression, and their copy. In a plain browser, or without the Desktop bridge's `activity` reporter, the plugin is inert. Use it when the Desktop shell must raise native attention while its window is hidden, minimized, or unfocused.

## Table of Contents

- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

Completion reports follow session-level convergence: a session that keeps running through queued or chained turns stays silent until its driver converges, and the first observation of any session is a baseline instead of a report, so boot, reconnection, and catalog replacement never fabricate a completion. Subagent rows that appear only as catalog fallbacks are never reported. Approval reports wrap — never consume — the scoped waterfall: the plugin registers before the approval presenter, reports once when a request arrives, and reports resolution when the consumer's answer settles.

<a id="model-experience"></a>
## Model Experience

None, as this package observes client-side session state and registers nothing model-facing.

#### KV Cache effect

None; attention reporting does not alter a model request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **The shell owns presentation and policy** — this package reports facts only; suppression rules, notification copy, settings, and click behavior are owned by the Desktop shell, and system focus modes can still suppress the resulting notifications.


<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
