import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { appendLedger, readLedger } from './util-ledger.js';
import { readState, writeState } from './util-state.js';
import { fingerprint } from './verify.js';

// Transition owner (audit F03/F04): the sanctioned operations that move a
// project through repeated change loops. Every operation reads the current
// state, builds the next whole state, and lands it through util-state's
// single write path — so schema validation, append-only history, and the
// workflow invariants (one step at a time, closed checkpoints) apply to
// every transition exactly as they do to hand writes.
//
// The operations, and the preconditions each enforces:
//   startChange      no other active change; seeds a new walk segment at
//                    FEATURE step 7 (the bounded change loop's entry)
//   advance          an active change; moves the walk one step, appends
//                    history tagged with the change id
//   completeChange   the change is active; records done + completed date,
//                    clears the active pointer, ends the walk segment
//   blockChange      the change is active; records blocked with a reason
//   reopenChange     the change is done or blocked; a reason is required;
//                    the change becomes active again with a fresh segment
//   recordRelease    every referenced change is done; one prepared candidate
//   markReleased     the candidate is prepared; records the release date
//   recordMaintenance an event-driven upkeep record (kind + notes)
//
// Completion evidence gating (audit F01): a change that declares criteria
// completes only when every criterion holds a passing verification run FOR
// THAT change, newer than the change's latest revision watermark, whose
// evidence file still exists. Missing evidence, zero discovery, wrong-
// candidate runs, and stale proof each block completion. A change without
// declared criteria completes ungated — tier floors arrive with the
// verification epic's tiering; the gate is criteria-scoped today and says
// so.

/** Today as an ISO date. @returns {string} */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The next free id: PREFIX-001, PREFIX-002, ... based on the highest existing.
 * @param {{id: string}[]} entries
 * @param {string} prefix
 * @returns {string}
 */
function nextId(entries, prefix) {
  let max = 0;
  for (const entry of entries) {
    const m = new RegExp(`^${prefix}-(\\d+)$`).exec(entry.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

/**
 * @param {string} reason one-line tail after the `util-transitions:` prefix
 * @returns {never}
 */
function fail(reason) {
  throw new Error(`util-transitions: ${reason}`);
}

/**
 * Start a new change: identity, active status, and a fresh walk segment at
 * the FEATURE entry step. The previous change's walk segment stays in
 * history untouched — the second feature never overwrites the first.
 * @param {string} projectRoot
 * @param {{kind: string, title: string, id?: string}} spec
 * @returns {{id: string}} the started change's id
 */
export function startChange(projectRoot, spec) {
  const state = readState(projectRoot);
  const kind = String(spec.kind ?? '');
  if (!['feature', 'bugfix', 'chore'].includes(kind)) {
    fail(`kind must be one of feature, bugfix, chore (got ${kind || '(none)'})`);
  }
  const title = String(spec.title ?? '').trim();
  if (title === '') fail('a change needs a title');
  const changes = Array.isArray(state.changes) ? /** @type {Record<string, unknown>[]} */ (state.changes) : [];
  if (state.active !== undefined) {
    const active = changes.find((c) => c.id === state.active);
    if (active && active.status === 'active') {
      fail(
        `change ${String(state.active)} is already active — complete or block it before starting another`,
      );
    }
  }
  let id = spec.id !== undefined ? String(spec.id) : nextId(changes, 'C');
  if (changes.some((c) => c.id === id)) fail(`change id already exists: ${id}`);
  const date = today();
  changes.push({ id, kind, title, status: 'active', created: date, updated: date });
  // Features, bug fixes, and chores all run the bounded FEATURE loop
  // (7-14); releases and events are records, not walk segments.
  const walk = { stage: 'FEATURE', step: 7, updated: date, change: id };
  const history = Array.isArray(state.walk_history)
    ? /** @type {Record<string, unknown>[]} */ (state.walk_history)
    : [];
  history.push({ ...walk });
  writeState(projectRoot, {
    ...state,
    changes,
    active: id,
    walk,
    walk_history: history,
  });
  return { id };
}

/**
 * Advance the active change's walk one step. The one-step and checkpoint
 * invariants are enforced by util-state; this operation exists so the
 * change tag and history append always travel together.
 * @param {string} projectRoot
 * @returns {{step: number}} the new step
 */
export function advance(projectRoot) {
  const state = readState(projectRoot);
  if (state.active === undefined) {
    fail('no active change — start one with change start');
  }
  const walk = /** @type {Record<string, unknown>} */ (state.walk ?? {});
  const step = /** @type {number | undefined} */ (walk.step);
  if (step === undefined) fail('the walk carries no step to advance from');
  if (step >= 22) fail('the walk is at step 22 — no step 23 is ever written');
  const date = today();
  const nextWalk = { ...walk, step: step + 1, updated: date, change: String(state.active) };
  const history = Array.isArray(state.walk_history)
    ? /** @type {Record<string, unknown>[]} */ (state.walk_history)
    : [];
  history.push({ ...nextWalk });
  writeState(projectRoot, { ...state, walk: nextWalk, walk_history: history });
  return { step: step + 1 };
}

/**
 * The evidence verdict for one declared criterion, against the ledger.
 * Read-only; `change check` renders it, `completeChange` enforces it.
 * @param {Record<string, unknown>[]} entries the ledger
 * @param {string} changeId
 * @param {string} criterion
 * @param {string} projectRoot
 * @param {string} currentFingerprint the candidate fingerprint now
 * @returns {{status: 'pass'|'stale'|'missing', detail: string}}
 */
function criterionVerdict(entries, changeId, criterion, projectRoot, currentFingerprint) {
  const watermark = entries
    .filter((e) => e.change === 'change_revised' && e.check === changeId)
    .map((e) => e.ts)
    .sort()
    .at(-1);
  const runs = entries.filter(
    (e) => e.change === 'verification' && e.check === criterion,
  );
  for (const thisChange of runs
    .filter((e) => String(e.notes ?? '').includes(`change=${changeId}`) && e.result === 'pass')
    .slice()
    .reverse()) {
    if (watermark !== undefined && String(thisChange.ts) <= String(watermark)) {
      return {
        status: 'stale',
        detail: `proof predates the revision at ${watermark} — re-run verify for ${criterion}`,
      };
    }
    // Candidate binding (audit F14): proof recorded for a different
    // candidate (a moved branch, new commits) is stale even though the
    // bytes of the evidence file still exist.
    const proofFingerprint = String(thisChange.notes).match(/fingerprint=([^;]+)/)?.[1] ?? '';
    if (proofFingerprint !== currentFingerprint) {
      return {
        status: 'stale',
        detail: `proof is for another candidate (recorded ${proofFingerprint || 'unknown'}, current ${currentFingerprint}) — re-run verify for ${criterion}`,
      };
    }
    const evidence = String(thisChange.evidence ?? '');
    if (evidence === '' || !existsSync(path.join(projectRoot, ...evidence.split('/')))) {
      return { status: 'missing', detail: `evidence file gone: ${evidence}` };
    }
    return { status: 'pass', detail: evidence };
  }
  const wrongCandidate = runs.find((e) => e.result === 'pass');
  if (wrongCandidate !== undefined) {
    return {
      status: 'missing',
      detail: `a passing run for ${criterion} exists but names another change (${String(wrongCandidate.notes).match(/change=([^;]+)/)?.[1] ?? 'none'}) — run verify with --change ${changeId}`,
    };
  }
  return { status: 'missing', detail: `no verification run recorded for ${criterion}` };
}

/**
 * Read-only consistency check (audit F13): omitted criteria, orphan runs,
 * and stale proof for one change. Never writes.
 * @param {string} projectRoot
 * @param {{id?: string}} [spec]
 * @returns {{id: string, verdicts: {criterion: string, status: string, detail: string}[], orphans: string[]}}
 */
export function checkChange(projectRoot, spec = {}) {
  const state = readState(projectRoot);
  const id = String(spec.id ?? state.active ?? '');
  if (id === '') fail('no active change and no id given');
  const change = (Array.isArray(state.changes) ? state.changes : []).find((c) => c.id === id);
  if (!change) fail(`no such change: ${id}`);
  const criteria = Array.isArray(change.criteria) ? change.criteria.map(String) : [];
  const entries = readLedgerEntries(projectRoot);
  const currentFingerprint = fingerprint(projectRoot);
  const verdicts = criteria.map((criterion) => ({
    criterion,
    ...criterionVerdict(entries, id, criterion, projectRoot, currentFingerprint),
  }));
  const declared = new Set(criteria);
  const orphans = entries
    .filter((e) => e.change === 'verification' && String(e.notes ?? '').includes(`change=${id}`))
    .map((e) => String(e.check))
    .filter((c) => !declared.has(c));
  return { id, verdicts, orphans: [...new Set(orphans)] };
}

/**
 * @param {string} projectRoot
 * @returns {Record<string, unknown>[]}
 */
function readLedgerEntries(projectRoot) {
  try {
    return readLedger(projectRoot);
  } catch {
    return [];
  }
}

/**
 * Complete the active change (or the named one): status done, completion
 * date recorded, active pointer cleared. The record is durable — it
 * survives restarts and is never overwritten by the next change. A change
 * with declared criteria completes only when every criterion's evidence
 * verdict is `pass` (audit F01).
 * @param {string} projectRoot
 * @param {{id?: string}} [spec]
 * @returns {{id: string, gated: boolean}} the completed change's id
 */
export function completeChange(projectRoot, spec = {}) {
  const state = readState(projectRoot);
  const changes = Array.isArray(state.changes) ? /** @type {Record<string, unknown>[]} */ (state.changes) : [];
  const id = String(spec.id ?? state.active ?? '');
  if (id === '') fail('no active change and no id given');
  const change = changes.find((c) => c.id === id);
  if (!change) fail(`no such change: ${id}`);
  if (change.status !== 'active') fail(`change ${id} is ${String(change.status)}, not active`);
  const criteria = Array.isArray(change.criteria) ? change.criteria.map(String) : [];
  let gated = false;
  if (criteria.length > 0) {
    gated = true;
    const entries = readLedgerEntries(projectRoot);
    const currentFingerprint = fingerprint(projectRoot);
    for (const criterion of criteria) {
      const verdict = criterionVerdict(entries, id, criterion, projectRoot, currentFingerprint);
      if (verdict.status !== 'pass') {
        fail(`criterion ${criterion}: ${verdict.detail}`);
      }
    }
  }
  const date = today();
  change.status = 'done';
  change.completed = date;
  change.updated = date;
  const next = { ...state, changes };
  delete next.active;
  writeState(projectRoot, next);
  return { id, gated };
}

/**
 * Declare (or replace) a change's acceptance criteria: the criterion ids the
 * completion gate proves (audit F01). Declared criteria are the gate's
 * scope — work without declared criteria completes ungated and says so.
 * @param {string} projectRoot
 * @param {{id?: string, criteria: string[]}} spec
 */
export function setCriteria(projectRoot, spec) {
  const criteria = Array.isArray(spec?.criteria) ? spec.criteria.map((c) => String(c).trim()).filter(Boolean) : [];
  if (criteria.length === 0) fail('declare at least one criterion id');
  const state = readState(projectRoot);
  const id = String(spec?.id ?? state.active ?? '');
  if (id === '') fail('no active change and no id given');
  const changes = Array.isArray(state.changes) ? /** @type {Record<string, unknown>[]} */ (state.changes) : [];
  const change = changes.find((c) => c.id === id);
  if (!change) fail(`no such change: ${id}`);
  change.criteria = criteria;
  change.updated = today();
  writeState(projectRoot, { ...state, changes });
  return { id, criteria };
}

/**
 * Record a revision of a change (audit F13): the reason lands in the
 * append-only ledger as a watermark. Verification runs recorded before the
 * watermark stop counting as proof for the affected change, so revised
 * behavior cannot ride on stale evidence. Unrelated changes and historical
 * records stay untouched.
 * @param {string} projectRoot
 * @param {{id?: string, reason: string}} spec
 * @returns {{id: string, at: string}}
 */
export function reviseChange(projectRoot, spec) {
  const reason = String(spec?.reason ?? '').trim();
  if (reason === '') fail('a revision needs its reason');
  const state = readState(projectRoot);
  const id = String(spec?.id ?? state.active ?? '');
  if (id === '') fail('no active change and no id given');
  const changes = Array.isArray(state.changes) ? /** @type {Record<string, unknown>[]} */ (state.changes) : [];
  const change = changes.find((c) => c.id === id);
  if (!change) fail(`no such change: ${id}`);
  const at = new Date().toISOString();
  appendLedger(projectRoot, {
    ts: at,
    change: 'change_revised',
    check: id,
    result: 'revised',
    notes: reason,
  });
  return { id, at };
}

/**
 * Block the active change: status blocked with a reason. The active pointer
 * stays — resuming is the normal next action once the blocker clears.
 * @param {string} projectRoot
 * @param {{reason: string}} spec
 */
export function blockChange(projectRoot, spec) {
  const reason = String(spec?.reason ?? '').trim();
  if (reason === '') fail('blocking needs a reason');
  const state = readState(projectRoot);
  if (state.active === undefined) fail('no active change to block');
  const changes = Array.isArray(state.changes) ? /** @type {Record<string, unknown>[]} */ (state.changes) : [];
  const change = changes.find((c) => c.id === state.active);
  if (!change) fail(`active change ${String(state.active)} has no record`);
  if (change.status !== 'active') fail(`change ${String(change.id)} is ${String(change.status)}, not active`);
  change.status = 'blocked';
  change.block_reason = reason;
  change.updated = today();
  writeState(projectRoot, { ...state, changes });
  return { id: String(change.id) };
}

/**
 * Reopen a done or blocked change with a reason: the sanctioned route back,
 * recorded on the change itself (audit F04: reopening is justified). The
 * change becomes the active one and its walk segment resumes.
 * @param {string} projectRoot
 * @param {{id: string, reason: string}} spec
 */
export function reopenChange(projectRoot, spec) {
  const id = String(spec?.id ?? '');
  const reason = String(spec?.reason ?? '').trim();
  if (id === '') fail('reopen needs the change id');
  if (reason === '') fail('reopen needs a reason');
  const state = readState(projectRoot);
  const changes = Array.isArray(state.changes) ? /** @type {Record<string, unknown>[]} */ (state.changes) : [];
  const change = changes.find((c) => c.id === id);
  if (!change) fail(`no such change: ${id}`);
  if (change.status !== 'done' && change.status !== 'blocked') {
    fail(`change ${id} is ${String(change.status)} — only done or blocked changes reopen`);
  }
  change.status = 'active';
  change.reopen_reason = reason;
  change.updated = today();
  writeState(projectRoot, { ...state, changes, active: id });
  return { id };
}

/**
 * Record a release candidate binding completed changes. Every referenced
 * change must exist and be done — a release candidate is proven work, not
 * intent.
 * @param {string} projectRoot
 * @param {{changes: string[], id?: string}} spec
 */
export function recordRelease(projectRoot, spec) {
  const state = readState(projectRoot);
  const wanted = Array.isArray(spec?.changes) ? spec.changes.map(String) : [];
  if (wanted.length === 0) fail('a release candidate names at least one change');
  const changes = Array.isArray(state.changes) ? /** @type {Record<string, unknown>[]} */ (state.changes) : [];
  for (const id of wanted) {
    const change = changes.find((c) => c.id === id);
    if (!change) fail(`no such change: ${id}`);
    if (change.status !== 'done') {
      fail(`change ${id} is ${String(change.status)} — only done changes join a release candidate`);
    }
  }
  const releases = Array.isArray(state.releases) ? /** @type {Record<string, unknown>[]} */ (state.releases) : [];
  const id = spec?.id !== undefined ? String(spec.id) : nextId(releases, 'R');
  if (releases.some((r) => r.id === id)) fail(`release id already exists: ${id}`);
  releases.push({ id, changes: wanted, status: 'prepared', created: today() });
  writeState(projectRoot, { ...state, releases });
  return { id };
}

/**
 * Mark a prepared release candidate released.
 * @param {string} projectRoot
 * @param {{id: string}} spec
 */
export function markReleased(projectRoot, spec) {
  const id = String(spec?.id ?? '');
  if (id === '') fail('markReleased needs the release id');
  const state = readState(projectRoot);
  const releases = Array.isArray(state.releases) ? /** @type {Record<string, unknown>[]} */ (state.releases) : [];
  const release = releases.find((r) => r.id === id);
  if (!release) fail(`no such release: ${id}`);
  if (release.status !== 'prepared') fail(`release ${id} is already ${String(release.status)}`);
  release.status = 'released';
  release.released = today();
  writeState(projectRoot, { ...state, releases });
  return { id };
}

/**
 * Record an event-driven maintenance entry (drift review, restore drill,
 * retirement decision — when triggered, not on a mandatory stage).
 * @param {string} projectRoot
 * @param {{kind: string, notes: string}} spec
 */
export function recordMaintenance(projectRoot, spec) {
  const kind = String(spec?.kind ?? '').trim();
  const notes = String(spec?.notes ?? '').trim();
  if (kind === '') fail('maintenance needs a kind');
  if (notes === '') fail('maintenance needs notes');
  const state = readState(projectRoot);
  const maintenance = Array.isArray(state.maintenance) ? /** @type {Record<string, unknown>[]} */ (state.maintenance) : [];
  maintenance.push({ at: today(), kind, notes });
  writeState(projectRoot, { ...state, maintenance });
  return { at: today() };
}
