---
description: "Sidebar footer panel estimating the active Session's spend from provider-reported usage and showing the DeepSeek account balance."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-usage-panel

English | [中文](README.zh.md)

## Summary

Use `dsh-client-ui-usage-panel` to keep spend and remaining credit visible without leaving the conversation. One row above the footer actions and Settings shows the active Session's estimated spend; expanding it lists spend per model route and the account's recharge balance, and marks a low balance with a top-up link. The estimate prices provider-reported usage against the model catalog's published rate cards, applying the peak or off-peak rate in force for each recorded request hour.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The Web app bundle mounts the package by default; removing its `ui-usage-panel` row removes the panel. It registers one occupant of the sidebar's public [`sidebar.footer.panel`](../ui-sidebar/README.md) single slot, above the footer actions and the Settings row. The panel renders nothing while the account is signed out or its state is unknown.

Wide sidebar: a 32px summary row shows the usage glyph, the localized "Usage" label, the active Session's estimated spend, and a chevron. With a low balance it adds a warning dot. Selecting the row expands a detail card above it listing spend per provider/model/effort route with catalog names, the recharge balance, the low-balance line, and links to Platform usage and top-up. Collapsed rail: one icon whose tooltip repeats the session spend and balance; the low-balance dot remains.

The active Session is the one retained by the main view. Without one — or before any usage settles — the row reads "No usage yet" and the detail shows only the balance. The panel reads the account through the shared `accountRead` service and re-reads only the recharge wallets when the detail opens.

Low-balance thresholds are deployment configuration, per wallet currency:

```yaml
- id: ui-usage-panel
  name: '@deepseek-ai/dsh-client-ui-usage-panel'
  config:
    lowBalance:
      USD: 1
      CNY: 10
```

A currency without a threshold is never marked low. The defaults are 1 USD and 10 CNY.

<a id="understand-the-implementation"></a>
## Understand the implementation

The `usageByRoute` projection from [`dsh-token-meter`](../../llm/token-meter/README.md) supplies provider-reported usage bucketed by provider, model, reasoning effort, and UTC hour-of-week. [`pricing.ts`](src/client/pricing.ts) prices each bucket against the route's catalog rate card: cache-miss input, output, and the optional cache-hit and cache-write rates, divided by one million tokens. Each bucket is scaled by the rate card's `offPeakMultiplier` when `ctx.pricePhase.at()` reports off-peak for that hour-of-week; the published schedule repeats weekly, so one Monday anchors every slot. Amounts use exact decimal arithmetic and are totaled per currency. Tokens whose route or cache bucket has no published rate stay visible as unpriced tokens rather than borrowing another rate.

Catalog names replace raw provider/model/effort ids when available; without a catalog the ids stay verbatim. The catalog read is the same `ctx.modelDirectories.modelCatalog` generation the model selectors use, so a label surface never fetches a second catalog.

The package owns no Host service, storage, or timer: `ctx.pricePhase.reading` already advances at each billing boundary, `ctx.accountRead` already follows the account stream, and the usage projection is Host-computed. The panel only re-reads the balance when its detail opens.

<a id="model-experience"></a>
## Model Experience

None, as the package is a browser-side UI layer over recorded usage and account reads; it registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Chinese public holidays are not tracked.** The shared phase schedule treats announced holiday hours as peak, so the estimate can overstate spend on those weekdays. The direction is visible to the reader and never hides cost.
- **The figure is an estimate, not an invoice.** It trusts provider-reported usage and the catalog's published rates; a relay, negotiated price, or a provider-side discount that the catalog does not state is not reflected.
- **Only the active Session is priced.** Other listed Sessions keep their projections, but the panel intentionally follows the main-view Session instead of aggregating the catalog.
- **Low balance compares each wallet in its own currency.** No exchange rate is applied, and a signed-out account has no balance to compare.
- **Platform links open in a new browser tab.** Unlike Account settings on Desktop, the panel has no native embedded-page channel; top-up and usage open externally.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The default thresholds approximate one substantive Session; a deployment that prices its own alert level overrides them in `cordis.yml`. The panel reads the catalog through `ctx.modelDirectories.modelCatalog` and the account through `ctx.accountRead`; both are documented service faces, not feature-plugin value imports.

</details>
