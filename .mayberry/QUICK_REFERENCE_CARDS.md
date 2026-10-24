<a id="chapter_26"></a>

# Quick Reference Cards

Use these during work. They deliberately summarize actions rather than reteaching the chapters. The Golden Path supplies the connected end-to-end sequence.

<a id="c01"></a>

## C01 — Before Starting a Project

Name the user/problem/outcome. Check existing alternatives. Define constraints and non-goals. Identify the highest-consequence assumption. Select the smallest complete useful workflow. Create only the documentation that has something meaningful to say.

**Open:** [W01](worksheets/W01_Project_Idea_and_Problem_Canvas.md#w01)–[W03](worksheets/W03_Product_Contract_Requirements_and_MVP.md#w03); Chapters 1–3.

<a id="c02"></a>

## C02 — Before Starting a Feature

Link the requirement and milestone. Inspect the current path. Preserve existing work. Define success, failure behavior and non-goals. Choose Quick/Standard/Deep. Plan evidence before edits.

**Open:** [W09](worksheets/W09_Feature_Change_Brief.md#w09); Chapter 8.

<a id="c03"></a>

## C03 — Before Letting the Agent Edit Code

Confirm repository, baseline, allowed scope and tool permissions. Explain the approach and simpler alternative. Identify data/security effects, checks and recovery. Stop for unverified consequential assumptions or newly broadened scope.

**Open:** [W09](worksheets/W09_Feature_Change_Brief.md#w09)/W10; Chapters 1/12/18.

<a id="c04"></a>

## C04 — Human Checkpoint

In your words: what changes; why; current behavior; evidence; approach and alternative; impact; verification; regression; recovery; Done. Use the relevant subset for Quick work. Unexplained terminology means ask for a concrete walkthrough.

**Open:** [W10](worksheets/W10_Human_Checkpoint.md#w10); Chapter 1.

<a id="c05"></a>

## C05 — Debugging

Reproduce. Separate expected from actual. Preserve evidence. Identify what changed. Rank competing hypotheses. Predict before each controlled test. Correct the cause or label a mitigation. Recheck the original case and regressions.

**Open:** [W11](worksheets/W11_Bug_Investigation.md#w11)/W12; Chapter 9.

<a id="c06"></a>

## C06 — Testing

Name the realistic failure. Choose the cheapest reliable level. Use controlled fixtures and independently justified expectations. Cover relevant denied/failure/empty/concurrency paths. Tie results to the final candidate. Record unrun checks honestly.

**Open:** [W13](worksheets/W13_Test_and_Verification_Plan.md#w13); Chapter 10.

<a id="c07"></a>

## C07 — Reviewing AI Changes

Read the requirement, then the complete diff. Inspect unexpected files, weakened checks, dependencies, data/security and compatibility. Verify findings and actual test output. Review the post-fix artifact, not just the first implementation.

**Open:** [W14](worksheets/W14_Change_Review_Checklist.md#w14); Chapter 11.

<a id="c08"></a>

## C08 — Before Committing

Check status and both unstaged/staged diffs. Preserve unrelated work. Confirm no secrets or unintended generated data. Run relevant checks. Stage one coherent change and write intent. A commit is not permission to push or deploy.

**Open:** Chapter 7; [W14](worksheets/W14_Change_Review_Checklist.md#w14).

<a id="c09"></a>

## C09 — Before a Migration

Confirm exact data target and old/new compatibility. Preserve through an engine-appropriate backup. Test restore in isolation. Rehearse transformation, interruption and validation. Plan concurrent writes, rollback/forward and authorization.

**Open:** [W19](worksheets/W19_Migration_Backup_and_Recovery_Plan.md#w19); Chapter 15.

<a id="c10"></a>

## C10 — Before Releasing

Name the exact candidate and audience. Verify the built/installed artifact, required checks, configuration, data/recovery and supported targets. Review known limitations. Confirm runbook, authority and post-release checks. Hold on required missing evidence.

**Open:** [W17](worksheets/W17_Release_Readiness.md#w17)/W18; Chapter 14.

<a id="c11"></a>

## C11 — After Releasing

Verify live/installed version and configuration. Exercise critical user workflows. Inspect meaningful error/data signals. Communicate limitations and support. Pause or recover at the agreed trigger; preserve evidence of significant failure.

**Open:** [W20](worksheets/W20_Post-Release_and_Incident_Review.md#w20); Chapter 16.

<a id="c12"></a>

## C12 — Periodic Maintenance

Review relevant updates and platform changes, backup/restore evidence, recurring bugs, tests, storage and documentation. Use event triggers for urgent issues. Keep one action list with owners. Remove recurring checks that detect nothing actionable.

**Open:** [W21](worksheets/W21_Periodic_Maintenance_Review.md#w21); Chapter 16.

<a id="c13"></a>

## C13 — When Something Goes Wrong

Contain ongoing harm within authority. Preserve logs/data/candidate identity. State known impact and uncertainty. Investigate rather than stack fixes. Distinguish mitigation from correction. Verify user recovery and create proportional prevention.

**Open:** [W11](worksheets/W11_Bug_Investigation.md#w11)/W20; Chapters 9/16.

<a id="c14"></a>

## C14 — When the AI Sounds Too Complicated

Ask what observed problem each mechanism solves, what simpler alternative exists, what complexity it introduces and whether it can be deferred. Require a relevant experiment or constraint. Sophisticated terminology is not architecture evidence.

**Open:** [W07](worksheets/W07_Consequential_Decision_Record_ADR.md#w07); Chapter 5.

<a id="c15"></a>

## C15 — When You Do Not Understand the AI

Ask for the real input-to-output path, definitions in plain English and a concrete example. Explain it back without copying. Compare with code or source evidence. Do not approve a consequential action simply to keep momentum.

**Open:** [W10](worksheets/W10_Human_Checkpoint.md#w10)/W25; Field Guide.

<a id="c16"></a>

## C16 — When the Agent Wants More Permissions

Identify the exact capability, target, consequence and necessity. Prefer isolated fixtures and restricted credentials. Review untrusted content and external effects. Authorize only bounded access with a checkpoint/recovery path. Past success is not blanket permission.

**Open:** [W16](worksheets/W16_Security_Escalation_and_Threat_Check.md#w16)/W24; Chapter 18.

<a id="c17"></a>

## C17 — When You Are Considering a Rewrite

Name the demonstrated blocker and behavior inventory. Compare leave/refactor/component replacement first. Include migration, coexistence, support and recovery. Prototype the hardest unknown. Do not treat a clean start as evidence that costs disappear.

**Open:** [W22](worksheets/W22_Refactor_Replace_Rewrite_or_Leave_It.md#w22)/W23; Chapter 17.

<a id="c18"></a>

## C18 — Before Implementing an Interaction

Trace one complete user task. Define waiting, empty, partial, failed, denied, cancelled and recovered states where relevant. Make primary actions and status meaningful. Check keyboard/focus and labels. Prototype the uncertainty, then observe the task without coaching. Keep planned usability checks distinct from observed results.

**Open:** [W28](worksheets/W28_user_flow_interaction_states_and_usability.md#w28); [P30](prompts/P30.md#p30); Chapter 2.

<a id="c19"></a>

## C19 — Before Accepting a Data Model

Name identities, relationships, ownership and invariants. Separate facts, calculations, caches and history. Walk through duplicate/concurrent writes and deletion. Choose storage and indexes for real access patterns. Link any valuable-data evolution to compatibility and tested recovery.

**Open:** [W29](worksheets/W29_data_model_ownership_and_lifecycle.md#w29); [P31](prompts/P31.md#p31); Chapter 5.

<a id="c20"></a>

## C20 — Before Connecting Systems

Inspect the real versioned contract. Define inputs/outputs/errors, permission, deadlines, repeated requests, pagination and compatibility. For events, verify authenticity, durable acceptance and duplicate/order rules. Test the real boundary safely; mock agreement is not provider evidence.

**Open:** [W30](worksheets/W30_api_and_integration_contract.md#w30); [P32](prompts/P32.md#p32); Chapter 5.

<a id="c21"></a>

## C21 — Before Claiming a Feature Worked

Return to the original outcome. State the metric definition, baseline and population. Check missing/duplicate/test data and query logic. Add user observations. Separate improvement from causal proof. Record the decision and limitations; do not count deployment as outcome evidence.

**Open:** [W31](worksheets/W31_outcome_measurement_and_product_decision.md#w31); [P33](prompts/P33.md#p33); Chapter 16.

<a id="c22"></a>

## C22 — Before Changing Hosting or Infrastructure

Confirm account/environment and exact resources. Map runtime, public exposure, durable data, DNS/TLS and operational owners. Check costs, limits, logs and recovery. Preserve prior configuration. Approval to inspect or plan does not authorize provisioning, new access, deletion or deployment.

**Open:** [W32](worksheets/W32_hosting_environments_and_operational_responsibility.md#w32); [P34](prompts/P34.md#p34); Chapter 14.

<a id="c23"></a>

## C23 — Before Shipping an AI-Powered Feature

Confirm the deterministic alternative and bounded capability. Record model/prompt/retrieval/tools versions. Check schema separately from truth. Run representative/negative cases and inspect failures. Enforce permissions outside the model. Verify privacy, budgets, fallback and monitoring; no unrun eval may be called a pass.

**Open:** [W33](worksheets/W33_ai_feature_contract_and_evaluation.md#w33); [P35](prompts/P35.md#p35); Chapter 19.

<a id="c24"></a>

## C24 — What runs when?

Coding: affected fast checks. Task: acceptance, related regressions and relevant static/integration checks. Commit: cheap checks and staged diff; pre-push is optional. Integration: clean declared state and actual combined candidate. Release: exact artifact plus applicable upgrade, security, compatibility, performance and eval evidence. Installed/live: identity, critical workflow and data/signals. Periodic: only justified drift or accumulation. Reuse valid evidence; broaden for uncertain impact.

**Open:** [W34](worksheets/W34_Verification_Operating_Map.md#w34); Chapter 10 cadence matrix; [D28](DECISION_AIDS.md#d28).

<a id="c25"></a>

## C25 — Trust the evidence, not the color

Confirm candidate/configuration, actual command, intended discovery, skips, first failures and retry outcomes. Verify that failures reach the required decision. A controlled failing case should block where policy says it must. Protect assertions, fixtures, selection, baselines and gates from unapproved changes. Missing or stale required evidence is not a pass.

**Open:** [W13](worksheets/W13_Test_and_Verification_Plan.md#w13)/W34; Chapters 10–11; [P37](prompts/P37.md#p37).

<a id="c26"></a>

## C26 — Before updating existing users

Separate fixes, runtime compatibility and upgrade support. Name source/target state and real artifacts. Preserve old fixtures and recovery; verify eligibility and trusted distribution. Rehearse the real update, meaning/settings/permissions, restart, rerun, interruption and refusal. Distinguish old-code rollback from data recovery and later writes. Define channels, inability to update and retirement.

**Open:** [W35](worksheets/W35_Installed-Version_and_Upgrade_Plan.md#w35)/W19; Chapter 14; [P38](prompts/P38.md#p38)/P39.

<a id="c27"></a>

## C27 — Before making it faster

Define the user symptom, workload, baseline and correctness. Profile the resource that can explain it. Predict a bounded change, compare repeated equivalent trials and keep raw failures. Recheck correctness, memory, errors and cost. Treat patterns as hypotheses. Automate comparison before blocking; protect thresholds and baselines.

**Open:** [W36](worksheets/W36_Performance_Investigation_Record.md#w36); Chapter 20; [D30](DECISION_AIDS.md#d30); [P40](prompts/P40.md#p40)/P41.
