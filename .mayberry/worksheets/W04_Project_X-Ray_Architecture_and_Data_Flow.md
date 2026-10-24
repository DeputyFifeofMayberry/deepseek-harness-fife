<a id="w04"></a>

## W04 — Project X-Ray, Architecture and Data Flow

**Purpose:** Create an evidence-based mental model.

**Use when:** An unfamiliar codebase or a consequential change to the system map. **Skip when:** You only need a narrow delta to a current verified map.

| Prompt | Your response |
|---|---|
| **Repository baseline**<br>Root, branch, commit, working-tree changes; instruction scope. |  |
| **Entry points and responsibilities**<br>Actual paths/symbols for UI, coordination, domain work and integrations. |  |
| **One successful and one failed path**<br>Input → processing → state/data → output; include error handling. |  |
| **State and data ownership**<br>Source of truth, readers/writers, lifetime, persistence and invalidation; link [W29](W29_data_model_ownership_and_lifecycle.md#w29) identity/model review where relevant. |  |
| **Trust and external boundaries**<br>Filesystem/network/commands/credentials; read versus write permissions. |  |
| **Build, runtime, tests and distribution**<br>Verified commands, supported targets and actual evidence; [W32](W32_hosting_environments_and_operational_responsibility.md#w32) hosting and [W33](W33_ai_feature_contract_and_evaluation.md#w33) runtime-AI map where applicable. |  |
| **Risks, unknowns and next check**<br>Uninspected areas, contradictions, important assumptions and safe investigation. |  |

**Close the worksheet when:** The map refers to inspected code rather than inferred folder names.

**Use with:** Chapters 4–5; [P05](../prompts/P05.md#p05)/P06.
