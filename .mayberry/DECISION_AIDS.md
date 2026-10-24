<a id="chapter_22"></a>

# Decision Aids

These are judgment aids, not a scoring model. Read the condition, take the branch that fits the evidence, and record why a consequential exception is acceptable.

<a id="d01"></a>

## D01 — How much planning does this require?

Could failure lose valuable data, cross a security boundary, cause material operational harm, or be difficult to reverse? If yes, use Deep regardless of apparent simplicity. If consequences are ordinary but the cause is initially unclear, begin with a bounded investigation—usually Standard; an unknown cause by itself does not require Deep. Escalate to Deep when uncertainty persists after that investigation, spans unfamiliar or broad systems, or could change architecture, data, security, recovery, or compatibility decisions. If the change is isolated, understood, and easily checked and reversed, use Quick. Use Standard for the remaining normal feature and bug work. Reassess when evidence changes; never average away a high-consequence risk.

**Use with:** [W09](worksheets/W09_Feature_Change_Brief.md#w09)/W10; Chapters 1 and 8.

<a id="d02"></a>

## D02 — Do I need more research?

Name the unresolved question and the decision it could change. If it could invalidate the product, architecture, permission model or recovery, keep the gate open. If the next step is a safe, bounded experiment that can answer it, do that rather than gathering more general links. If remaining uncertainty has low consequence and is reversible, proceed with an explicit assumption and revisit trigger. Stop researching when a decision is supported—not when the internet is exhausted.

**Use with:** [W02](worksheets/W02_Research_Gate_and_Assumption_Test.md#w02); Chapter 3.

<a id="d03"></a>

## D03 — Is this actually a requirement?

Can you connect it to a user outcome, necessary protection or binding constraint? If not, park it as an idea. If yes, can you state observable behavior and a way to check it? If not, clarify before implementation. Determine whether it describes an outcome or merely a preferred solution. Preserve a true constraint, but allow implementation alternatives where the outcome does not require a particular technology.

**Use with:** [W01](worksheets/W01_Project_Idea_and_Problem_Canvas.md#w01)/W03; Chapter 2.

<a id="d04"></a>

## D04 — Does it belong in the MVP?

Would removing it prevent the first complete useful workflow, invalidate the learning goal, or remove necessary safety? If yes, include the smallest adequate version. If no, defer it. Ask whether a manual step or existing tool can temporarily satisfy the need without misleading users or exposing data. Do not defer security or recovery that the current functionality genuinely requires. A future idea is not a current obligation.

**Use with:** [W03](worksheets/W03_Product_Contract_Requirements_and_MVP.md#w03)/W08; Chapters 2 and 6.

<a id="d05"></a>

## D05 — Do we need an architectural change?

Identify the observed constraint: ownership confusion, inability to test, demonstrated performance, deployment need, or a required capability the current design cannot support. Compare a local correction first. If the local option is adequate, prefer it. If a boundary must change, describe its new responsibilities, interfaces and data ownership; evaluate alternatives and transition risk. Do not add architecture solely because an agent uses the words scalable or enterprise-ready.

**Use with:** [W07](worksheets/W07_Consequential_Decision_Record_ADR.md#w07)/W22; Chapter 5.

<a id="d06"></a>

## D06 — Should I add this dependency?

Does an existing dependency or platform feature solve the need adequately? If yes, avoid a new obligation. If no, verify exact identity, supported version, license, permissions, maintenance, and material effects introduced by dependencies of that dependency (transitive effects). Run a bounded fit experiment for uncertain integration. Prefer the dependency only when its benefit exceeds its credible integration and maintenance cost. For security-sensitive functions, avoiding a dependency is not an excuse to invent an unsafe replacement.

**Use with:** [W05](worksheets/W05_Dependency_Inventory.md#w05)/W15; Chapters 3 and 12.

<a id="d07"></a>

## D07 — Do I need a database?

Must information survive the process? If not, do not add storage. If it can be safely reconstructed, compare recomputation with a persisted copy. For simple settings, a validated file may suffice. For structured relationships, atomic changes or queries, consider an embedded database. For networked shared writers, evaluate a managed/server database against actual concurrency and operational needs. Large file bytes may belong in object storage alongside metadata elsewhere. Design identity, constraints, ownership, queries and deletion before choosing; see [W29](worksheets/W29_data_model_ownership_and_lifecycle.md#w29). Review the actual engine’s limits and backup behavior. No option removes recovery or permission responsibilities. [S42](REFERENCES.md#s42)

**Use with:** [W04](worksheets/W04_Project_X-Ray_Architecture_and_Data_Flow.md#w04)/W07/W19; Chapters 5 and 15.

<a id="d08"></a>

## D08 — Is this abstraction justified?

Do the repeated pieces express the same stable concept and have the same reason to change? If yes, a small common interface may help. If the similarity is only superficial or future variation is unknown, keep them understandable and separate for now. Ask what complexity the abstraction hides, what assumptions it imposes and whether ordinary parameters suffice. Revisit when actual repetition or testing pressure demonstrates a need.

**Use with:** [W07](worksheets/W07_Consequential_Decision_Record_ADR.md#w07)/W22; Chapter 5.

<a id="d09"></a>

## D09 — Do I need automated tests?

Will the behavior be reused or changed, is failure costly, or is manual rechecking unreliable? Automate the useful repeatable cases. For a truly disposable task on replaceable data, an explicit manual procedure and comparison can suffice. Automation is especially valuable for data integrity, repeated bugs and invisible state logic. Do not automate a poorly defined expectation; clarify the requirement first. Choose a check whose maintenance cost fits its protection.

**Use with:** [W13](worksheets/W13_Test_and_Verification_Plan.md#w13); Chapter 10.

**For one proposed check:** use [D27](#d27) to test the oracle, existing protection, failure detection, lifetime effort and execution home.

<a id="d10"></a>

## D10 — Which kind of test?

Can the failure be observed in a small behavior with controlled inputs? Start there. Does it depend on the real filesystem, database, protocol or collaborating parts? Add integration evidence. Does only the assembled user journey reveal it? Use a small end-to-end check. Does it concern usability, keyboard interaction or ambiguous visual behavior? Add human exploration. Label regression and smoke checks by their purpose; they may use any appropriate technical level.

**Use with:** [W13](worksheets/W13_Test_and_Verification_Plan.md#w13)/P15; Chapter 10.

<a id="d11"></a>

## D11 — Should I fix this now?

Is harm ongoing, a critical workflow blocked, or the next change/release unsafe without it? Prioritize a fix or mitigation. Otherwise compare user impact, recurrence, available workaround, current milestone and risk of changing it. Park low-impact cosmetic or speculative improvements separately. Do not bundle unrelated fixes into an active change merely because the file is open. Record a revisit trigger for intentionally deferred consequential work.

**Use with:** [W06](worksheets/W06_Risk_Assumption_and_Technical_Unknown_Register.md#w06)/W27; Chapters 16 and 17.

<a id="d12"></a>

## D12 — Is this bug urgent?

Assess current harm and exposure, not message volume. Suspected data loss, unauthorized access or material service failure calls for immediate containment and an owner. A core workflow failure affecting users needs timely investigation and a communicated next step. A bounded issue with a reliable workaround can be scheduled. A cosmetic preference belongs in normal triage. Confirm facts while preserving evidence; an unknown serious risk may justify restriction before cause is proven.

**Use with:** [W11](worksheets/W11_Bug_Investigation.md#w11)/W20; Chapter 16.

<a id="d13"></a>

## D13 — Should I refactor?

Name the concrete change cost or failure risk the structure creates. If you cannot, leave stable behavior alone. If a local behavior-preserving change can reduce that cost and its invariants can be checked, scope the refactor. Separate new behavior from restructuring. Expand only when evidence shows the local option is inadequate. The desired outcome is safer/easier future change, not aesthetic conformity to an agent’s preferred pattern.

**Use with:** [W22](worksheets/W22_Refactor_Replace_Rewrite_or_Leave_It.md#w22)/W27; Chapter 17.

<a id="d14"></a>

## D14 — Should I rewrite?

First compare leaving it, a local refactor, and replacement of the failing boundary. If these can meet necessary requirements at acceptable cost/risk, prefer them. A rewrite needs evidence that smaller options are inadequate, a behavior inventory, migration plan, coexistence/support strategy and realistic acceptance evidence. Prototype the hardest unknown before committing. Do not treat unfamiliarity, age or a new framework release as sufficient justification.

**Use with:** [W22](worksheets/W22_Refactor_Replace_Rewrite_or_Leave_It.md#w22)/W23; Chapter 17.

<a id="d15"></a>

## D15 — Do I need deeper security review?

Does the change introduce identity, cross-user access, sensitive records, payments, privileged commands/files, external input or broader agent access? If yes, inspect the trust boundary and use Deep planning where consequences warrant it. Obtain qualified review for controls you cannot responsibly assess. If none of these apply, perform the relevant basic checks and record exclusions. A local tool still needs review when it can access valuable files or credentials.

**Use with:** [W16](worksheets/W16_Security_Escalation_and_Threat_Check.md#w16); Chapter 12.

<a id="d16"></a>

## D16 — Does this decision deserve an ADR?

Will future contributors need the rationale, is reversal costly, or does the choice constrain structure, interfaces, storage, security or supported behavior? Write a brief ADR. If it is a routine local choice whose reason is obvious in code, use an ordinary commit/message or nothing additional. When new evidence changes an accepted significant decision, supersede the record; do not rewrite history to make the new choice look inevitable.

**Use with:** [W07](worksheets/W07_Consequential_Decision_Record_ADR.md#w07); Chapters 5 and 13.

<a id="d17"></a>

## D17 — Is this ready to release?

Is the exact candidate identified? Are required checks current and passing? Are significant security/data risks resolved or accepted by an authorized owner, and are recovery and user impact understood? If any required answer is missing or negative, hold. If all are satisfied, release through the runbook and verify afterward. A conditional decision must name the remaining gate; it is not permission to quietly skip it.

**Use with:** [W17](worksheets/W17_Release_Readiness.md#w17)/W18; Chapter 14.

<a id="d18"></a>

## D18 — Is greater agent autonomy appropriate?

Can the task be bounded by files, capabilities, environment, resources and success evidence? Are checks reliable enough to expose likely errors, and can actions be recovered? If yes, grant only the required capabilities. If the task crosses new trust, data, cost or deployment boundaries, require explicit approval and stronger isolation. Do not use a model’s confidence or previous success as a substitute for controls. Test execution itself may be privileged.

**Use with:** [W09](worksheets/W09_Feature_Change_Brief.md#w09)/W24; Chapters 12 and 18.

<a id="d19"></a>

## D19 — Do I need a backup or recovery plan?

Can the work alter persistent or irreplaceable information, configuration, remote state or access? If yes, define preservation and recovery before the change. Determine tolerable data loss and downtime, and test the relevant restore/roll-forward path. For reproducible derived data, rebuilding may be recovery. For source-only reversible work, a verified Git checkpoint may be enough. Never assume code rollback restores remote side effects or live data.

**Use with:** [W19](worksheets/W19_Migration_Backup_and_Recovery_Plan.md#w19); Chapter 15.

<a id="d20"></a>

## D20 — Should this knowledge stay persistent?

Will it guide repeated work, preserve a consequential decision, explain a hard-to-discover boundary, or enable setup/recovery? Put a concise verified statement in its canonical home. If it is temporary output, speculative explanation or already recorded elsewhere, keep it out of always-loaded instructions. Link rather than duplicate. Give durable knowledge an update trigger and owner; remove or supersede stale material instead of accumulating contradictory summaries.

**Use with:** [W24](worksheets/W24_Project_Status_and_Agent_Session_Handoff.md#w24); Chapter 13.

<a id="d21"></a>

## D21 — How much UX design does this need?

Is the change isolated with known state/failure behavior? Inspect and verify locally. Does a person cross screens, make consequential choices, recover from failure or use the product without explanation? Map the flow and states and prototype the uncertain part. If misunderstanding could cause harm, review consequences and accessibility before implementation. Before claiming usability, observe relevant users or state that evidence is missing. Public scope increases the need for representative evidence, not the need for decorative design deliverables.

**Use with:** [W28](worksheets/W28_user_flow_interaction_states_and_usability.md#w28)/P30; Chapter 2.

<a id="d22"></a>

## D22 — Is the data model ready for a schema?

Can you explain identity, relationships, ownership and the facts that must stay true using actual example records? If not, resolve those questions first. If yes, try create/edit/delete, duplication and relevant concurrent writes. Identify which rules need storage enforcement and which need application authorization. If valuable existing data or meaning changes, use [W19](worksheets/W19_Migration_Backup_and_Recovery_Plan.md#w19) before execution. A model is ready to implement when consequential decisions and checks are explicit—not when an agent has generated SQL.

**Use with:** [W29](worksheets/W29_data_model_ownership_and_lifecycle.md#w29)/P31; [D07](#d07); Chapter 5.

<a id="d23"></a>

## D23 — Is this interface a durable compatibility contract?

Does another released client, repository, user, integration or plugin rely on the boundary independently of this deployment? If yes, document behavior, errors and supported-version transitions and test relevant consumers. If all callers change together, a compact signature/schema and behavioral tests may suffice. Any consequential external effect still needs authorization, retry and recovery rules. Independently check claimed provider guarantees; control of both codebases does not synchronize installed versions.

**Use with:** [W30](worksheets/W30_api_and_integration_contract.md#w30)/P32; Chapter 5.

<a id="d24"></a>

## D24 — Do I need product analytics or direct observation?

Name the product decision and evidence that could change it. If you can inspect a few real tasks directly, start there rather than adding telemetry. If patterns across use are needed, define minimal events and a trustworthy metric contract. If the metric cannot distinguish activity from the desired outcome, revise it or combine it with observation. If privacy cost exceeds decision value, collect less or change the method. Sparse or confounded data calls for a limited conclusion, not a confident impact claim.

**Use with:** [W31](worksheets/W31_outcome_measurement_and_product_decision.md#w31)/P33; Chapter 16.

<a id="d25"></a>

## D25 — Where should this application run?

Does it need local files/devices or offline use? Keep that work local or design an explicit permitted transfer/agent boundary. Is serving static files enough? Do not add a server without a trusted runtime need. For server work, compare a managed platform with self-managed control using persistence, background work, access, operational skill and total cost. Check provider limits and recovery before deciding. Add replicas or infrastructure only for an evidenced constraint, not hypothetical popularity.

**Use with:** [W32](worksheets/W32_hosting_environments_and_operational_responsibility.md#w32)/P34; Chapter 14.

<a id="d26"></a>

## D26 — Should this capability use runtime AI?

Can deterministic rules or an existing workflow meet the actual requirement more reliably? Prefer them when adequate. If language ambiguity/generation justifies a model, can you define acceptable and forbidden behavior, representative evaluations, data permissions, cost/latency and failure handling? If not, run a bounded synthetic-data experiment or defer. If wrong output can cause serious effects, require trusted enforcement and appropriate human authority before exposure. Never add tool autonomy merely because the model can request it.

**Use with:** [W33](worksheets/W33_ai_feature_contract_and_evaluation.md#w33)/P35; Chapter 19.

<a id="d27"></a>

## D27 — Should This Check Be Automated?

First clarify expected behavior. If it is only observed historical behavior, label characterization rather than silently accepting it as a contract. Ask whether the behavior merits preservation, whether failure is consequential or checking repeated, and whether an independently justified automated oracle is possible. If human interpretation is essential, keep that judgment manual and automate only the reliable mechanical parts. Inspect existing protection before adding a duplicate. Demonstrate that the proposed check detects a meaningful wrong result. Name its runner, suite, trigger, gate and owner. Without those, it is not maintained protection. Compare construction, execution and maintenance with repeated manual effort and missed-defect risk; do not invent a numerical automation score.

**Use with:** [D09](#d09) for the project-level question; [W13](worksheets/W13_Test_and_Verification_Plan.md#w13)/W34; Chapter 10; [P15](prompts/P15.md#p15)/P36.

<a id="d28"></a>

## D28 — What Must Pass at This Gate?

Name the decision: G0 safe work, G1 verified task, G2 combined-state integration, G3 named release, G4 healthy rollout or G5 maintained baseline. Read the applicable QUALITY.md policy and candidate/configuration identity. Select checks by consequence and affected boundaries, broadening for shared changes or unknown impact. Reuse earlier evidence only when its assumptions still hold. Confirm the intended command and discovered tests, unexpected skips, first failures/retries and failure propagation. Required missing, blocked or failed evidence holds that decision; advisory evidence stays visible with an owner. Do not demand release-only evidence for every task or convert a required failure into a warning for convenience.

**Use with:** [W13](worksheets/W13_Test_and_Verification_Plan.md#w13)/W17/W34; Chapter 10; [C24](QUICK_REFERENCE_CARDS.md#c24)/C25.

<a id="d29"></a>

## D29 — Which Versions and Updates Will We Support?

List real installed states and separately choose maintenance support, runtime compatibility and upgrade support. Include only relevant data/configuration/platform/API/plugin/trust dimensions. Prefer a direct supported user transition where practical; an internal migration chain need not require manual intermediate installations. Select previous/oldest and materially different historical states, not an unjustified two-version sample. Choose real update and activation mechanisms, stable/pilot/channel policy, interruption and downgrade behavior, and a safe route when updating is impossible. Preserve historical artifacts/fixtures, require applicable rehearsal evidence, and state how each promise retires. Do not promise a transition that remains untested or disable trust checks to reach it.

**Use with:** [W35](worksheets/W35_Installed-Version_and_Upgrade_Plan.md#w35)/W19/W23; Chapters 14–15/17; [P38](prompts/P38.md#p38)/P39.

<a id="d30"></a>

## D30 — What Should I Measure Next?

Name the user-visible symptom and reproduce its workload first. If the baseline is not comparable, fix the measurement before optimizing. If elapsed time is high, distinguish active CPU work from waiting: CPU profile for computation; I/O/off-CPU or network evidence for waiting; query analysis for database work; UI timeline for responsiveness; heap/allocation evidence for memory; traces for a multi-stage path. Form a prediction from the evidence and test a bounded change. Compare repeated trials and correctness, not the best run. If noise or sample size prevents a conclusion, collect the next discriminating observation. Automate reporting before blocking; a release limit requires a stable, meaningful requirement.

**Use with:** [W36](worksheets/W36_Performance_Investigation_Record.md#w36); Chapter 20; [P40](prompts/P40.md#p40)/P41; [C27](QUICK_REFERENCE_CARDS.md#c27).
