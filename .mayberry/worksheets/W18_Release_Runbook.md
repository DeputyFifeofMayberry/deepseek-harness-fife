<a id="w18"></a>

## W18 — Release Runbook

**Purpose:** Release and verify through a known sequence.

**Use when:** Any release with repeatable steps or meaningful consequences. **Skip when:** A disposable experiment that is not being distributed or relied upon.

| Prompt | Your response |
|---|---|
| **Candidate, target and authorization**<br>Source revision and, when available, exact artifact identity; configuration, destination and release owner. |  |
| **Recovery prerequisites and trigger**<br>Previous artifact; backup if needed; rollback/forward compatibility and decision owner. |  |

| Step / action to define | Expected result | Actual / evidence / owner |
| --- | --- | --- |
| 1. Confirm candidate source revision and target |  |  |
| 2. Confirm readiness and recovery prerequisites |  |  |
| 3. Select already verified artifact OR build/package the candidate |  |  |
| 4. If built/rebuilt/changed, revalidate required checks on the exact artifact |  |  |
| 5. Distribute/deploy only the approved verified artifact |  |  |
| 6. Check installed/live version, artifact identity and config |  |  |
| 7. Run critical smoke, upgraded-state and applicable performance checks |  |  |
| 8. Observe pilot/error/integrity/latency stop criteria; pause or recover as authorized |  |  |
| 9. Communicate outcome and release notes |  |  |

**Close the worksheet when:** The exact distributed/deployed artifact has current required evidence, its installed/live identity and critical user workflow are verified, recovery triggers were observed, and the final outcome and communication are recorded.

**Use with:** Chapter 14; [P22](../prompts/P22.md#p22).
