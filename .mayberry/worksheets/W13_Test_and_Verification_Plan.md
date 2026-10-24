<a id="w13"></a>

## W13 — Test and Verification Plan

**Purpose:** Choose evidence by failure risk.

**Use when:** Standard/Deep work or a release candidate. **Skip when:** Quick work can record a few explicit expected/actual observations.

| Prompt | Your response |
|---|---|
| **Candidate and environment**<br>Commit/artifact/working-tree identity; runtime/platform/configuration. |  |
| **Requirements and risks**<br>List accepted behavior/failure risks and independent expectations; label characterization/history separately. Include applicable interactions, contracts, upgrades, performance and AI cases. |  |
| **Fixtures and isolation**<br>Versioned representative inputs and independent outputs, safe isolated destinations, sensitive-data restrictions, lifecycle cleanup and crash-recovery limits. |  |
| **Check portfolio**<br>Case ID, meaningful failure and cheapest reliable level; automate / manual / extend existing / defer with reason, repetition/stability/consequence and maintenance cost. |  |
| **Procedures and oracle**<br>Exact existing command or manual procedure; independent oracle, original-defect/controlled-failure detection and discovery evidence; proposed commands stay unverified. |  |
| **Suite, trigger and maintenance**<br>Suite membership, actual execution event, broadening rule, gate consequence, report and maintaining owner; link [W34](W34_Verification_Operating_Map.md#w34)/QUALITY.md. |  |
| **Execution evidence**<br>Candidate, command, selected/discovered/executed/skipped cases; expected/actual, status, first failure/retries, raw-output location and run date. |  |
| **Gaps and release consequence**<br>Unverified behavior, owning decision, required task/integration/release gate or advisory status; authority and reason for an accepted limitation. |  |

**Close the worksheet when:** Required checks apply to this candidate, independent expectations are justified, reusable protection is discoverable and registered, and the task/integration/release consequence of missing evidence is explicit.

**Use with:** Chapter 10; [P15](../prompts/P15.md#p15)/P16.

**Registration record to duplicate:** case/requirement → existing or new test → suite/command → execution trigger and broadening rule → required gate or advisory status → maintenance owner. Link recurring policy in QUALITY.md/W34; do not duplicate it in every task.
