<a id="w34"></a>

## W34 — Verification Operating Map

**Purpose:** Make recurring verification commands, triggers and consequences discoverable in one canonical home.

**Use when:** A project will be maintained or repeatedly changed. **Skip when:** A disposable task needs only an explicit one-time check.

| Prompt | Your response |
|---|---|
| **Project profile and consequences**<br>Tiny / Personal / Shared / Public / Critical; important failure risks and exceptions that override size. |  |
| **Canonical home and commands**<br>Link QUALITY.md or its README section; runner/configuration, verified commands and proposed-but-unverified commands; supported environments. |  |
| **Suites and purpose**<br>For each useful suite: important failures, included tests or selection rule, runner command and report location. Do not list every assertion twice. |  |
| **Execution triggers and broadening**<br>Coding / task / commit / optional push / integration / release / installed-live / justified periodic; caller/shared-boundary and unknown-impact rules. |  |
| **Environment, isolation and cost**<br>Runtime/dependency state, fixtures, safe destinations, restricted credential references, worker isolation, expected runtime and approved external-cost limits. |  |
| **Gate and result policy**<br>G0–G5 applicability; required versus advisory; discovery/skip evidence, failure propagation and controlled-failure rehearsal; evidence-reuse conditions. |  |
| **Fixture and cleanup lifecycle**<br>Origin/version, immutable versus mutable data, clocks/seeds, real-boundary coverage, setup/teardown and crash-safe disposal rules. |  |
| **Flake and quarantine policy**<br>First failure/retries; classification; owner/issue; review or expiry trigger; explicit lost protection, alternate checks and ongoing observation. |  |
| **Agent authority**<br>Permitted edits/runs; protected oracles, fixtures, snapshots, selection, skips, tolerances, baselines and workflows; separate approval and bounded-repair limits. |  |
| **Maintenance triggers and links**<br>Suite runtime, repeated failures, new boundaries, support/platform/provider change, obsolete fixtures and benchmark drift; [W21](W21_Periodic_Maintenance_Review.md#w21) owner and issue links. |  |

**One suite record to duplicate:** suite ID/purpose; command and selection; trigger; broaden when; environment/credentials; runtime/cost expectation; required gate or advisory status; report/candidate identity; owner. Transfer accepted policy into QUALITY.md and keep this worksheet as a linked decision record, not a competing live policy.

**Close when:** A new person or agent can determine what to run, what the result means and who may change the policy without inventing it. Proposed commands remain unverified until executed safely.

**Use with:** Chapters 10/13/18; [W13](W13_Test_and_Verification_Plan.md#w13)/W21; [D27](../DECISION_AIDS.md#d27)/D28; [P36](../prompts/P36.md#p36)/P37; [C24](../QUICK_REFERENCE_CARDS.md#c24)/C25.
