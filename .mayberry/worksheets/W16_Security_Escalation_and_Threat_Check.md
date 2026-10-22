<a id="w16"></a>

## W16 — Security Escalation and Threat Check

**Purpose:** Identify the boundary and decision that need stronger review.

**Use when:** New exposure, sensitive data, privileged tools, identity/access or uncertain controls. **Skip when:** Use basic checks when no meaningful boundary changes; record why.

| Prompt | Your response |
|---|---|
| **Assets and harm**<br>Data, credentials, money, availability, privacy or important operations. |  |
| **Actors and entry points**<br>Users, imports, network callers, dependencies and agents; trusted vs untrusted. |  |
| **Trust boundaries and abuse cases**<br>What must be denied? Include hostile inputs/tools, cross-user retrieval/cache and infrastructure exposure when relevant. |  |
| **Controls and evidence**<br>Validation, authorization, least privilege, safe logging, isolation and denied-case tests. |  |
| **Agent permissions**<br>Required tools/paths/network; commands/actions needing explicit approval. |  |
| **Unresolved decision and qualified owner**<br>What expertise/authority is needed, options and consequences. |  |
| **Safe next action and gate**<br>Continue bounded investigation; specify what must precede release or risky execution. |  |

**Close the worksheet when:** Security uncertainty is visible and cannot be authorized away by the agent.

**Use with:** Chapter 12; [D15](../DECISION_AIDS.md#d15)/D18; [P18](../prompts/P18.md#p18).
