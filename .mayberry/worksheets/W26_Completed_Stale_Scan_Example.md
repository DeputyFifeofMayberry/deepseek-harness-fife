<a id="w26"></a>

## W26 — Completed Example: A Stale Scan Overwrites the Screen

**Purpose:** show how a requirement, investigation, change and verification connect. **Use when:** you need an example of a completed Change Brief. **Skip when:** you already understand the workflow; use [W09](W09_Feature_Change_Brief.md#w09) for your actual task.

Project Radar is fictional. The small in-memory Python lab in the template pack was actually executed for this edition. Its results are real evidence for that model only—not evidence about an installed desktop app, filesystem traversal, or your repository.

### Product and scope

**Requirement R-04:** only the latest requested scan may update visible results, errors or loading state. **Milestone:** M3 reliability. **Feature F-07:** predictable refresh behavior. **Planning depth:** Standard for the isolated in-memory correction; a real application requires its own risk classification.

**Problem:** start A, start B, finish B, then finish A. The old completion replaces B. **Non-goals:** no new UI, filesystem watcher, cache, storage, dependency, deployment or source-file writes.

### Investigation and approach

**Observed baseline:** the deliberately broken coordinator accepts completions without checking active request identity. Forced ordering reproduces stale result and error updates, stale loading completion, and late completion after cancellation.

**Alternatives:** sorting cannot correct ownership; a timed delay only changes when the symptom occurs; cancellation alone does not establish that every late completion is ignored. **Chosen change:** assign each request an identity and accept state changes only from the active request. Cancellation revokes current ownership.

**Impact:** result, error and loading transitions. **Recovery:** switch back to the prior example variant or source checkpoint; no persistent data exists in this lab. This is not a general data-recovery strategy.

### Verification and outcome

| Check | Broken variant | Corrected variant |
|---|---|---|
| Active success displays normally | Pass | Pass |
| Active failure displays normally | Pass | Pass |
| Old success cannot replace newer result | Fail | Pass |
| Old error cannot replace newer success | Fail | Pass |
| Old completion cannot clear current loading | Fail | Pass |
| Repeated scans need distinct request identity | Fail | Pass |
| Cancellation prevents late result acceptance | Fail | Pass |

**Execution:** the included lab uses Python's standard-library `unittest` and deterministic completion order. The intentional broken run exits 1 with five failures; the corrected run exits 0 with seven passing tests. Source hash, runtime and full outputs are included in `examples/stale_scan_lab/TEST_RESULTS.md` and adjacent output files.

**Not run / not represented:** actual asynchronous filesystem work, UI wiring, platform permissions, accessibility, package installation, production configuration and distributed-user testing. These remain requirements for a real application's release assessment.

**Review finding addressed by the model:** guarding results alone is insufficient; old errors and completion/loading transitions also need ownership checks. **Durable record:** state-ownership invariant in ARCHITECTURE.md and corresponding regression cases in QUALITY.md. **Done for the lab:** the seven stated in-memory behaviors have evidence. **Release state of the fictional app:** not established.

**Teach-back:** explain why matching a folder name is insufficient when two scans target the same folder, and why cancelling work is not the same as revoking its right to update state.

### Extension A — register the regression and exercise its gate

The template pack now includes `test_ownership.py` and `verify_fast.py` beside the unchanged lab. The test-discovery wrapper loads the seven existing request-ownership checks; the runner reports candidate file hashes, Python/environment identity, discovered count, skips and result. It refuses zero or unexpectedly changed discovery in this fixed teaching fixture. A real evolving project should review meaningful discovery changes rather than freeze a universal test count.

From `examples/stale_scan_lab`, run:

```text
python verify_fast.py
python verify_fast.py --broken-demo
```

The second command deliberately selects the already supplied broken model in that process. Its nonzero exit is the intended demonstration, not a command to weaken the gate. The corrected command and controlled broken command were executed for this revision; the registration record and raw output are in `REGISTRATION_RESULTS.md`. This proves discovery and local failure propagation for this small lab. It does not prove a hosted repository branch rule or any real application gate.

**Illustrative application operating map / Not run:** place the equivalent request-ownership tests in Radar's fast correctness suite. Run affected cases while editing the coordinator, the fast suite at G1/task completion and cheap pre-commit checking, and required fast plus relevant integration on the actual combined candidate at G2. At G3 reuse valid logic evidence and add real package/UI/filesystem checks. Copy the command into an actual runner/CI policy only after it exists and its failure propagation has been tested. Registering the lab locally does not activate automation in your repository.

### Extension B — a saved-history upgrade, not a fresh-install demonstration

**Status: illustrative / Not run.** The following version labels and records are teaching inputs, not existing Radar releases. No historical application, installer, upgrade or data-recovery test was executed or supplied as a working implementation.

Suppose an approved history extension changes **application 0.4 / history format 1** to **application 0.5 / history format 2**. Version 1 preserved a timestamp string without its original timezone. Version 2 makes timestamp interpretation explicit. The accepted invariant is that an unknown original zone remains unknown: preserve the raw timestamp and mark its interpretation as unspecified. Do not fabricate a precise UTC value. Preserve stable scan/item identities, relationships, selected roots, partial/failure status and user settings; source export files remain untouched.

| [W35](W35_Installed-Version_and_Upgrade_Plan.md#w35) decision | Illustrative plan | Evidence status |
|---|---|---|
| Maintenance / runtime / upgrade support | New target receives fixes; runtime combinations are declared separately; 0.4-to-0.5 direct upgrade is the proposed route | Proposed, not a supported release claim |
| Historical source | Preserve the actual 0.4 artifact, its valid format-1 fixture and producing recipe; include a state from any earlier supported upgrade | Historical artifacts/fixtures not available in this teaching pack |
| Mechanism and migration | Candidate applies its internal transformation through the real update/first-start route; control writers and back up via [W19](W19_Migration_Backup_and_Recovery_Plan.md#w19) | Not run |
| Semantic and restart verification | Check unchanged identifiers/relationships/settings, unknown-zone meaning, source-file nonmutation and correct workflow after restart | Not run |
| Rerun and interruption | Already-converted state is recognized safely; interrupt at meaningful durable boundaries and follow the approved recovery branch | Not run |
| Downgrade and refusal | Old code must not read new state without established compatibility; reject newer/unsupported formats before partial writes; define restore loss and later-write handling | Not run |
| Gate and retained protection | Register cheap format transitions plus selected real installer cases in the release/upgrade suite; required evidence belongs to [W17](W17_Release_Readiness.md#w17)/G3 | Release readiness not established |

A fixture consisting only of a new-version object serialized by current code would miss the old timestamp ambiguity. Preserve the old representation and provenance; then compare *meaning*, not just row counts or successful parsing. Retirement of the old upgrade source requires a separate [W23](W23_Major_Transition_Deprecation_and_Retirement.md#w23) decision and a usable transition/export route.

### Extension C — investigate a slow scan without inventing results

**Status: illustrative / Not run.** This is a completed investigation design with deliberately unfilled measurement outcomes, not a claim that a real bottleneck or speedup was observed.

| [W36](W36_Performance_Investigation_Record.md#w36) field | Illustrative investigation record |
|---|---|
| Symptom and consequence | A reported slow large-directory refresh delays finding the intended latest export. Confirm frequency and actual user conditions before accepting the report as reproduced |
| Workload and oracle | Version a permitted synthetic directory corpus with documented depth, file mix, timestamps and failure cases; independently specify expected results, ordering and partial status |
| Baseline and environment | Record actual revision/artifact, runtime, machine/storage, click-to-usable-result boundary, cold/warm policy and repetitions. Baseline measurements: Not run |
| Profiling question | Separate enumeration/metadata, filtering/sorting and UI publication; inspect CPU and I/O waits. Profiling evidence and bottleneck: Not established |
| Conditional hypothesis | Only if repeated metadata reads dominate: reuse metadata within one scan, without caching across refreshes. Otherwise follow the evidence to another explanation |
| Candidate comparison | Apply one approved bounded change; run comparable repeated baseline/candidate trials; retain raw timings, resource/error results and exclusions. Candidate measurements: Not run |
| Correctness guardrail | Same required results and ordering, unchanged source files, accurate failure/partial status, cancellation and latest-request ownership. Application checks: Not run |
| Decision and retained benchmark | Keep / revise / revert / inconclusive remains Pending evidence. Begin a nonblocking retained comparison only if useful; no automatic threshold or baseline change |

The three extensions close one feedback loop: a supported promise gets a runnable regression; a data change adds historical-state evidence; a measured performance concern adds a comparable workload. Their evidence meets at the existing task/integration/release gates. None changes the original MVP or establishes the fictional application's release readiness.
