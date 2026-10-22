<a id="w22"></a>

## W22 — Refactor, Replace, Rewrite or Leave It

**Purpose:** Justify structural work against actual change pressure.

**Use when:** A cleanup, component replacement, major refactor or rewrite proposal. **Skip when:** No observed risk or future change cost exists.

| Prompt | Your response |
|---|---|
| **Observed cost and evidence**<br>Repeated defects, blocked requirement, change effort or unsupported dependency. |  |
| **Behavior and contracts to preserve**<br>Public interfaces, formats, workflows, integrations and current evidence. |  |
| **Options**<br>Leave, local refactor, component replacement, incremental transition, rewrite. |  |
| **Tradeoffs at actual scale**<br>Benefits, new complexity, migration/support obligations and credible cost/risk. |  |
| **Smallest viable experiment**<br>What could disprove the preferred option before a large commitment? |  |
| **Phased plan and verification**<br>Small boundaries, characterization/regression checks, integration and recovery. |  |
| **Decision and revisit trigger**<br>Authorized option, owner, assumptions, success evidence and stopping conditions. |  |

**Close the worksheet when:** Cleaner-looking code is not the only justification, and a rewrite is compared with smaller options.

**Use with:** Chapter 17; [D13](../DECISION_AIDS.md#d13)/D14; [P24](../prompts/P24.md#p24).
