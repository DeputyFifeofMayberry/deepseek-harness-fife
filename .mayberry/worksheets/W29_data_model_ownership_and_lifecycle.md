<a id="w29"></a>

## W29 — Data Model, Ownership and Lifecycle

**Purpose:** Review the information structure before committing to a schema.

**Use when:** New persistence, meaningful model changes, sharing, or uncertainty about identity and relationships. **Skip when:** A source-only change that preserves a current verified model.

| Prompt | Your response |
|---|---|
| **Need and persistence choice**<br>What must survive? Compare no storage/file/embedded/server/object storage using actual access needs. |  |
| **Entities, attributes and identity**<br>Name each entity; stable/natural/generated identifier; mutable display values; examples of records. |  |
| **Relationships and ownership**<br>One/one, one/many, many/many; required/optional links; authoritative readers/writers and access scope. |  |
| **Invariants and enforcement**<br>Required/unique/range/reference rules; storage vs app checks; concurrent write evidence needed. |  |
| **Stored, derived, cached or historical**<br>Meaning of copies, source of truth, observation time, recomputation/invalidation rule. |  |
| **Queries and transactions**<br>Real lookups/order; candidate indexes and tradeoff; changes that must become visible together. |  |
| **Deletion and evolution**<br>Restrict/cascade/archive/soft/hard delete; retention; old/new semantics; link [W19](W19_Migration_Backup_and_Recovery_Plan.md#w19) for actual migration. |  |
| **Review and gate decision**<br>Create/edit/query/duplicate/concurrent/delete examples; unresolved assumptions; owner; proceed/hold. |  |

**Close the worksheet when:** The required entities, identities, relationships, invariants, owners, query needs and lifecycle are coherent; significant unknowns are resolved or gated; any valuable-data transition is assigned a migration/recovery plan.

**Use with:** Chapter 5; [P31](../prompts/P31.md#p31); [D07](../DECISION_AIDS.md#d07)/D22; [C19](../QUICK_REFERENCE_CARDS.md#c19); [W04](W04_Project_X-Ray_Architecture_and_Data_Flow.md#w04)/W19.
