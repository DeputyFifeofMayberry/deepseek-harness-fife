<a id="w30"></a>

## W30 — API and Integration Contract

**Purpose:** Define obligations on both sides of a software boundary.

**Use when:** External integration, independently released consumer, plugin, webhook, or consequential interface change. **Skip when:** A small internal helper is adequately described by its signature and tests.

| Prompt | Your response |
|---|---|
| **Parties, versions and evidence**<br>Provider/consumer owners; official docs and checked version/date; confirmed vs inferred guarantees. |  |
| **Inputs and outputs**<br>Examples, types/units, required/optional/null/default/unknown fields; sizes, ordering and identifiers. |  |
| **Identity, permission and data**<br>Caller identity, object authorization, allowed disclosure, secrets and safe diagnostic fields. |  |
| **Errors and timing**<br>Stable error category/message; retryable/permanent/uncertain outcomes; deadlines and cancellation. |  |
| **Repeated and paged work**<br>Idempotency key/scope/lifetime; concurrent duplicates; pagination, ordering, token/snapshot assumptions. |  |
| **Webhook or event policy**<br>When relevant: signature/replay checks, duplicate/out-of-order handling, durable acceptance and reconciliation. |  |
| **Compatibility and dependencies**<br>Consumers, additive/breaking changes, version/deprecation path; rate/quota/cost/SDK constraints; [W15](W15_Dependency_Evaluation.md#w15) link. |  |
| **Contract checks and disposition**<br>Schema and real-boundary tests; denied/failure/duplicate/compatibility cases; evidence, gaps and owner. |  |

**Close the worksheet when:** The parties can explain successful, invalid, denied and uncertain exchanges; relevant delivery/compatibility rules and verification are defined; undocumented consequential guarantees remain explicit gates, not assumptions presented as facts.

**Use with:** Chapter 5; [P32](../prompts/P32.md#p32); [D23](../DECISION_AIDS.md#d23); [C20](../QUICK_REFERENCE_CARDS.md#c20); [W15](W15_Dependency_Evaluation.md#w15)/W17.
