<a id="w36"></a>

## W36 — Performance Investigation Record

**Purpose:** Turn a performance symptom into a comparable experiment and a justified decision.

**Use when:** A user-visible delay, throughput/capacity issue, resource growth, cost concern or suspected regression needs evidence. **Skip when:** No material symptom or requirement exists; do not optimize merely because a tool suggests it.

| Prompt | Your response |
|---|---|
| **Symptom, consequence and decision**<br>Affected user/operation; actual observation versus hypothesis; accept/revise/revert/investigate decision and owner. |  |
| **Workload, environment and correctness**<br>Versioned representative dataset, size/composition, supported hardware/runtime/storage/network; permission limits and independent behavior/integrity contract. |  |
| **Baseline identity and procedure**<br>Revision/artifact/configuration; workload version; timing boundaries/units/statistic; cold/warm/cache policy; repetitions and raw-results location. |  |
| **Profiling evidence and alternatives**<br>CPU/allocation/heap/I/O/network/DB/trace/UI evidence; limiting work/resource; competing explanations and instrumentation limits. |  |
| **Hypothesis and bounded change**<br>Predicted effect, smallest approved change, allowed scope and resource/cost limits; correctness/compatibility risks and recovery. |  |
| **Candidate comparison**<br>Exact candidate; same workload/conditions; all trials, failures/exclusions; latency/throughput/resources/errors/cost as relevant; known noise and sample limitations. |  |
| **Correctness recheck**<br>Results, ordering, permissions, data meaning, failure/cancellation, supported upgrades and runtime-AI quality where affected; link required checks. |  |
| **Decision and uncertainty**<br>Keep / revise / revert / insufficient evidence; comparison against a predeclared threshold, owner and next discriminating measurement. |  |
| **Budget or retained protection**<br>Target / investigation threshold / release limit; metric/workload/environment/statistic/threshold/owner/gate; manual → nonblocking → investigation → blocking → trend stage. |  |
| **Execution and baseline authority**<br>Cadence and suite in QUALITY.md; who approves workload/oracle/threshold/baseline changes; environment drift and [W21](W21_Periodic_Maintenance_Review.md#w21) review trigger. |  |

**Trial record to duplicate:** baseline/candidate identity; run order; environment/workload version; cold/warm condition; elapsed/resource measurements; correctness status; failed/timed-out attempt; raw evidence and exclusion reason, if any. Preserve unfavorable results.

**Close when:** The disposition has comparable measurement and correctness evidence, or explicitly remains inconclusive with the next observation defined. No claimed improvement or release clearance is based on unrun checks.

**Use with:** Chapter 20; [W13](W13_Test_and_Verification_Plan.md#w13)/W17/W21/W34; [D30](../DECISION_AIDS.md#d30); [P40](../prompts/P40.md#p40)/P41; [C27](../QUICK_REFERENCE_CARDS.md#c27).
