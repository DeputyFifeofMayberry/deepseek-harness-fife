<a id="w33"></a>

## W33 — AI Feature Contract and Evaluation

**Purpose:** Decide whether runtime AI is justified and prove the bounded capability.

**Use when:** The product itself calls a model, retrieves AI context, or executes model-proposed tools. **Skip when:** AI only helps write the code; use Chapter 18 instead.

| Prompt | Your response |
|---|---|
| **Capability and alternative**<br>User outcome, deterministic/manual baseline, allowed input/output, forbidden behavior and error consequences. |  |
| **Candidate manifest**<br>App/model/provider/prompt/settings/schema/retrieval/tools versions; aliases or other reproduction limits. |  |
| **Sources and privacy**<br>Authorized inputs, grounding, retention/training choices, derived data deletion, logs and cache isolation. |  |
| **Tools and authority**<br>Allowed action/object scope, server-side permission/argument checks, approval, idempotency and recovery; [W16](W16_Security_Escalation_and_Threat_Check.md#w16) link. |  |
| **Evaluation design**<br>Representative/development/held-out cases, expected behavior, grading rubric, human calibration and exposure rules. |  |
| **Acceptance and evidence**<br>Predefined blocking failures and quality criteria; repeats, actual outcomes vs transcripts, per-case limits. |  |
| **Latency, cost and fallback**<br>End-to-end deadline, tokens/tools/retries, per-user limits, cancellation/refusal/outage/uncertain-result behavior. |  |
| **Release, monitoring and decision**<br>Exact-candidate checks, observed quality/cost/error signals, owner, accept/hold/revise, rollback/fallback. |  |

**Case record to duplicate:** case ID/category; authorized fixture/version; expected or forbidden behavior; grading rule; baseline/candidate versions; repeat count; actual result/status; evidence; reviewer/disposition. Keep private fixtures outside public repositories.

**Close the worksheet when:** The AI capability and limits are justified, the exact candidate is identified, required deterministic and evaluation evidence is recorded, and privacy/permissions/budgets/fallback have controls. Unrun or failed release-critical checks mean hold; a planned eval is not a passed eval.

**Use with:** Chapter 19; [P35](../prompts/P35.md#p35); [D26](../DECISION_AIDS.md#d26); [C23](../QUICK_REFERENCE_CARDS.md#c23); [W13](W13_Test_and_Verification_Plan.md#w13)/W16/W17.
