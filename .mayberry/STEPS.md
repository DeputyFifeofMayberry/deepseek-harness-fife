# The 22-step operating registry

The pack-internal source of the walk: what each step is for, what it needs,
what it produces, and what guards it. GOLDEN_PATH.md remains the authoring
workbook's prose; this file is the shipped, compact form the installed skill
reads. The one-step and closed-checkpoint invariants are enforced by the
state owner (`util-state.js`); the transition operations live in
`util-transitions.js` and run through `node .mayberry/scripts/mayberry-api.js`.

Stages tile the steps with no gaps: PROJECT 1-6, FEATURE 7-14, RELEASE 15-18,
MAINTENANCE 19-22. Every repeated change (feature, bug fix, chore) is a
change record (`changes[]`) with its own walk segment starting at step 7.
Release candidates (`releases[]`) bind completed changes. Maintenance and
retirement are event-driven records, never a mandatory stage of every
journey. Gates G0-G5 and the six DO-NOT-PROCEED conditions are defined in
RULES.md — the normative registry this file references, never redefines.

Legend: **Input** what the step needs present; **Output** the durable result;
**Exit** the evidence that lets the step close; **Guards** live stop
conditions; **Next** what follows.

## PROJECT 1-6 — once per project, refreshed when context changes

**1. Define the outcome.**
Input: the user's situation in their words. Output: `docs/W01_...md`
instantiate, observed/assumed cells. Exit: user recognizes their situation;
constraint and non-goals named. Guards: RULES.md DO-NOT-PROCEED 1 (unresolved
behavior the work depends on). Next: step 2. Worksheet W01.

**2. Research the blockers.**
Input: the W01 unknowns that would change decisions. Output: `docs/W02_...md`
— assumptions, cheapest decision-changing evidence, closed gates. Exit:
each blocking assumption has a result or an explicit constraint. Guards: G0
evaluates before step 2's first action. Next: step 3. Worksheet W02.

**3. Specify the first useful product.**
Input: outcome + research. Output: `docs/W03_...md` — workflow, interaction
states, failure behavior, acceptance criteria, MVP boundary. Exit: every
acceptance criterion is testable; unrelated ideas are parked. Next: step 4.
Worksheets W03 (companions W28, W31 when relevant).

**4. Understand the system.**
Input: the specified behavior. Output: `docs/W04_...md` — one real action
traced through code, state, storage, and boundaries; uninspected areas
marked. Exit: the change path for step 7+ is known and named. Next: step 5.
Worksheet W04.

**5. Design only what matters now.**
Input: the traced system. Output: `docs/W07_...md` decision records with
rationale. Exit: consequential choices carry their reasons; runtime AI has
evaluations and limits defined. Next: step 6. Worksheet W07 (companions
W29, W30, W33 when relevant).

**6. Plan outcomes and the next slice.**
Input: design + priorities. Output: `docs/W08_...md` and `docs/W09_...md` —
milestone exit evidence, the next bounded slice, connected to requirements.
Exit: the first change's scope is bounded and named. Next: the first change
starts (`change start`, walk segment at step 7). Worksheets W08, W09.

## FEATURE 7-14 — once per change, repeated per change record

**7. Understand the change.**
Input: the requirement or bug report; project knowledge. Output: expected
behavior and non-goals, in the change record's terms. Exit: the change's
done-condition is stated. Guards: G0 when re-entering after context drift.
Next: step 8.

**8. Investigate first.**
Input: the affected path. Output: evidence — code read, reproduction for
bugs, competing explanations distinguished. Exit: the plan can name what
changes and why it is safe. Guards: DO-NOT-PROCEED 2 (uninspected path).
Next: step 9.

**9. Approve a bounded plan.**
Input: investigation. Output: the bounded plan — approach, scope, reusable
protection, recovery, Done. Exit: the Human Checkpoint answered (W10) —
the walk cannot advance past an open checkpoint; only the user's approve
lifts it. Next: step 10. Worksheet W10.

**10. Implement a coherent slice.**
Input: the approved plan. Output: the candidate — code plus targeted check
runs after meaningful edits. Exit: slice coherent, unrelated work preserved,
no new consequential decision taken unasked. Guards: DO-NOT-PROCEED 3, 4, 5.
Next: step 11.

**11. Verify the actual candidate.**
Input: the candidate. Output: executed checks with recorded expectations,
environment, actual results; "Not run" stays unverified. Exit: G1 passes —
required checks ran and passed; new tests are registered. Guards: G1 before
step 11's first action; DO-NOT-PROCEED 6 (missing/stale evidence). Next:
step 12.

**12. Review the diff.**
Input: the full diff. Output: reviewed behavior, failure paths,
data/security, compatibility; oracle and fixture changes inspected. Exit:
findings resolved; affected checks rerun. Next: step 13.

**13. Record the durable changes.**
Input: what changed. Output: canonical documents updated only where new
behavior, commands, boundaries, decisions, or limitations landed. Exit: a
reader of the canonical records would not be surprised by the diff. Next:
step 14.

**14. Commit deliberately.**
Input: the staged work. Output: the commit; combined-state integration
evidence for the change record. Exit: G2 passes before step 15 when this
change feeds a release candidate; a commit never authorizes deployment.
Next: the change completes (`change complete`), or steps 15-18 for a release
candidate.

## RELEASE 15-18 — when releasing; a candidate binds completed changes

**15. Prepare a named candidate.**
Input: the done changes joining the release (`release record`). Output:
`docs/W17_...md` — revision, artifact, build inputs, configuration,
supported targets. Exit: the candidate is named and its inputs recorded.
Next: step 16. Worksheets W17 (companions W32, W35 when relevant).

**16. Prove readiness.**
Input: the candidate. Output: applicable artifact, upgrade/migration,
compatibility, security, performance evidence — reused only when still
valid. Exit: G3 passes at step 17; required failures or unknowns hold the
release. Next: step 17.

**17. Release through the runbook.**
Input: authorization + the validated runbook. Output: the release executed;
recovery assets preserved; user impact communicated. Exit: the runbook's
steps are all evidenced. Next: step 18. Worksheets W18 (W19 when data
changes).

**18. Verify after release.**
Input: the live release. Output: installed identity, configuration, data
transition, critical workflow, error/latency signals — observed. Exit: G4
and G5 evaluate here; pilot stop criteria agreed. Next: `release mark`;
completed.

## MAINTENANCE 19-22 — event-driven, never a mandatory journey stage

**19. Monitor what matters.** Trigger: agreed signals or intervals. Output:
`docs/W31_...md` outcome comparison when relevant; owners for meaningful
failures. Guards: incident path (W11, W20) when something goes wrong.

**20. Maintain the baseline.** Trigger: drift, flakes, suite runtime,
upgrade fixtures. Output: `docs/W21_...md` review record; justified events,
not arbitrary nightly work. Record with `maintenance record`.

**21. Improve against evidence.** Trigger: recurring cost or harm. Output:
`docs/W22_...md`, `docs/W27_...md`; a bounded change record when work is
chosen.

**22. Retire responsibly when needed.** Trigger: an explicit retirement
decision. Output: `docs/W23_...md` — transitions, data, access revocation.
The walk's last step: the walk stays at 22, complete. A project keeps
working after it — the next change simply starts a new segment.

## Entries

**New project:** step 1. **Existing project (X-Ray):** read first, seed
`stage: existing`; the accepted brief anchors every later session, and the
first bounded change starts a walk segment at step 7 via `change start`.
**Incident (anything went wrong):** W11 then W20 at any stage; protect,
preserve, reproduce, explain, correct, verify, learn.
