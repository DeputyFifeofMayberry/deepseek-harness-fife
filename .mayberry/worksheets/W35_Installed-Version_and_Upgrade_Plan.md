<a id="w35"></a>

## W35 — Installed-Version and Upgrade Plan

**Purpose:** Define supported installed-state transitions and the evidence needed to preserve users and data.

**Use when:** Earlier installations, persistent settings/data, independently released clients, plugins or update channels must be supported. **Skip when:** No earlier installation or persistent state exists; record any fresh-install or platform checks in [W17](W17_Release_Readiness.md#w17) instead.

| Prompt | Your response |
|---|---|
| **Target and support promises**<br>Exact candidate/artifact; maintenance-supported releases; runtime-compatible combinations; supported upgrade sources. Keep the three promises separate. |  |
| **Installed-state inventory**<br>App/data/settings/configuration/platform/API/plugin/updater-trust versions as relevant; data, caches, credentials and in-progress work; authoritative locations. |  |
| **Transition matrix and historical evidence**<br>Source → target; direct or necessary intermediate app route; migration chain; preconditions; supported/refused/pending; provenance of old artifacts and fixtures. |  |
| **Selection and coverage**<br>Previous/oldest sources, distinct data boundaries, prior upgrade histories, historical defects and platform/plugin/trust changes; justify representative grouping. |  |
| **Update mechanism and trust**<br>Trusted distributor, metadata/signing mechanism, oldest-client trust path, key compromise/expiry response; references only, never signing secrets. |  |
| **Eligibility, activation and channels**<br>Download versus activation; managed/store/manual/web route; storage/permissions; unsaved work/restart/offline; stable/preview switching; forced-update reason and inability-to-update behavior. |  |
| **Transformation and writer control**<br>Link [W19](W19_Migration_Backup_and_Recovery_Plan.md#w19) for actual steps; concurrent writers, preservation, checkpoints, rerun/idempotency and interruption behavior. |  |
| **Recovery and downgrade**<br>Binary installation recovery versus persistent-state restore/roll-forward; old-code compatibility, post-update writes, loss limits and distribution constraints. |  |
| **Rehearsal and post-update evidence**<br>Exact source/target, valid old state, real mechanism, semantic/permission/settings checks, restart/rerun/interruption/refusal results; register suite and link [W17](W17_Release_Readiness.md#w17). |  |
| **Retirement, communication and authority**<br>Last maintained/minimum compatible/oldest source/last platform; export/transition and archive policy; user notice; approval owner and unresolved gates. |  |

**Transition row to duplicate:** source state and historical artifact/fixture → target artifact; route and eligibility; preserved invariants; test/evidence; failure/refusal response; supported status and owner. Include upgrade duration, first start or cache-rebuild limits when they matter to users.

**Close when:** Every promised transition has a defined outcome, evidence requirement and failure response. Release readiness remains pending wherever required rehearsals are unrun or failed; the support plan alone does not prove an upgrade.

**Use with:** Chapters 14/15/17; [W17](W17_Release_Readiness.md#w17)–[W19](W19_Migration_Backup_and_Recovery_Plan.md#w19)/W23; [D29](../DECISION_AIDS.md#d29); [P38](../prompts/P38.md#p38)/P39; [C26](../QUICK_REFERENCE_CARDS.md#c26).
