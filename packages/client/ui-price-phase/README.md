---
description: "Sidebar footer chip stating whether DeepSeek API billing is in peak or off-peak hours."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-price-phase

English | [中文](README.zh.md)

## Summary

Use `dsh-client-ui-price-phase` when work should follow DeepSeek API pricing: the API bills peak rates only during published windows, and everything else — including weekends and Chinese public holidays — is off-peak at half the peak price. The package mounts one quiet chip on the sidebar footer action seat that states the current phase at a glance and names the next phase flip on hover, on every screen that shows the sidebar. It also publishes one shared phase reading that other client surfaces price against.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The Web app bundle mounts the package by default; removing its `ui-price-phase` row removes the chip. The chip registers into the sidebar's public [`sidebar.footer.action`](../ui-sidebar/README.md) list, so a deployment can layer another occupant beside it or replace it the same way as any footer action. The chip is non-interactive: it opens nothing and changes nothing.

Wide sidebar: a small dot with the localized phase word ("Peak" / "Off-peak"). Collapsed rail: the dot alone. Either way a tooltip states the phase, the next flip in the reader's own time zone, and the published window definition.

The package publishes the reading as the client `pricePhase` service: `ctx.pricePhase.reading` is the boundary-advancing snapshot and `ctx.pricePhase.at(at)` is the pure schedule. A surface that prices recorded usage injects the service and reads the same snapshot instead of keeping a second timer.

<a id="understand-the-implementation"></a>
## Understand the implementation

`pricePhase(at)` in [`src/client/price-phase.ts`](src/client/price-phase.ts) computes the phase from the published schedule with pure UTC arithmetic: peak windows are 01:00–04:00 and 06:00–10:00 UTC, Monday through Friday ([Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing)). The reading carries `nextBoundary`, the instant the phase flips. One application-wide source in [`src/client/phase-source.ts`](src/client/phase-source.ts) arms a single timeout at that instant instead of ticking per second; a visibility change re-arms, so a suspended tab catches up when it returns, and the chip renders from the published snapshot. There is no Host service, storage, or network behind the chip — the schedule is a compiled constant of this package, and a pricing change is a one-line edit to `PEAK_WINDOWS` plus a documentation update.

## Model Experience

None, as the package is a browser-side UI layer that registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Chinese public holidays are not tracked.** The published schedule makes every holiday hour off-peak, but holiday dates are announced per year and a bundled table would go stale silently. On those weekdays the chip may read "peak" during window hours while billing is actually off-peak — the direction that overstates cost rather than hiding it. The tooltip states the holiday rule so the reader can resolve the ambiguity.
- The chip describes the official DeepSeek API billing schedule; requests routed through a relay or a custom provider do not bill on these windows, and the chip does not inspect the active route.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
