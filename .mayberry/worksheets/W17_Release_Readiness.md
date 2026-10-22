<a id="w17"></a>

## W17 — Release Readiness

**Purpose:** Make a go/hold decision for a named artifact.

**Use when:** A private, shared or public release. **Skip when:** A development checkpoint not intended for use as a release.

| Prompt | Your response |
|---|---|
| **Candidate and audience**<br>Revision/artifact/version; target environment; private/shared/public/sensitive. |  |
| **Decision and authority**<br>Go / hold / conditional gate; owner; accepted limitations and user impact. |  |

| Area | Status | Evidence / limitation | Owner / gate |
| --- | --- | --- | --- |
| Requirements and failure behavior |  |  |  |
| Tests and final review |  |  |  |
| Clean build / install / targets |  |  |  |
| Config / secrets / dependencies |  |  |  |
| Data / migration / restore |  |  |  |
| Supported upgrades / restart / refusal / interruption |  |  |  |
| Applicable performance / endurance / runtime-AI evidence |  |  |  |
| Privacy / security / licenses |  |  |  |
| Docs / version / release notes |  |  |  |
| Runbook / recovery / monitoring / applicable [W28](W28_user_flow_interaction_states_and_usability.md#w28)–[W36](W36_Performance_Investigation_Record.md#w36) evidence |  |  |  |

**Close the worksheet when:** Any required fail, blocked or unrun check means hold until resolved or legitimately re-scoped.

**Use with:** Chapter 14; [D17](../DECISION_AIDS.md#d17); [P21](../prompts/P21.md#p21)/P22.
