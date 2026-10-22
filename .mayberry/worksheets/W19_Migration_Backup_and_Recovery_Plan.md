<a id="w19"></a>

## W19 — Migration, Backup and Recovery Plan

**Purpose:** Protect persistent state through a version transition.

**Use when:** Any material persistent-data/format/schema change or recovery rehearsal. **Skip when:** Source-only change with no external/persistent side effects.

| Prompt | Your response |
|---|---|
| **Scope and compatibility**<br>[W35](W35_Installed-Version_and_Upgrade_Plan.md#w35) installed source/target artifacts and format versions; affected dataset; old/new app/data/configuration combinations and actual update route. |  |
| **Goals and constraints**<br>Tolerated data loss (RPO), downtime (RTO), concurrency and authority. |  |
| **Backup and restore evidence**<br>Engine-supported method, location/reference, keys, isolation and last tested restore. |  |
| **Transformation and checkpoints**<br>Steps; interruptions; progress; whether rerun is safe; concurrent writer strategy. |  |
| **Rehearsal corpus and validation**<br>Old/empty/invalid/large data; invariants, values and relationships—not counts alone. |  |
| **Failure branches and recovery**<br>Rollback vs restore vs roll-forward; treatment of writes since the backup. |  |
| **Execution approval and retirement**<br>Exact target confirmation, gate evidence, owner; when old data may be removed. |  |

**Close the worksheet when:** The migration sequence, compatibility assumptions, backup method, tested restore or roll-forward path, verification evidence, failure branches, owner, and recovery trigger are defined; a down script or Git revert alone is not accepted as recovery proof.

**Use with:** Chapter 15; [D19](../DECISION_AIDS.md#d19); [P20](../prompts/P20.md#p20).
