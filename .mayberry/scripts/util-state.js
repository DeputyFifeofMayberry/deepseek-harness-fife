import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseYaml, serializeYaml } from './util-yaml.js';

// State owner: single write path for .mayberry/state.yaml.
//
// Schema v2 (audit F04) separates durable project context and repeatable
// changes from the 22-step orientation walk: `changes` gives every feature,
// bug fix, and chore an identity, a status, and its own records; `releases`
// bind completed changes into named candidates; `maintenance` records
// event-driven upkeep; `adopted` holds the accepted canonical records. The
// walk stays as the position statement's orientation view, and each
// walk/history entry may carry the `change` id it belongs to, so the second
// feature starts its own walk segment instead of overwriting the first.
//
// Every key except version may be absent; unknown keys and wrong shapes fail
// on both read and write, one line, naming the key path. `flags` is written
// with reserved defaults when absent so fresh state always carries it, and
// the write lands via temp file + rename so a crash cannot leave a
// half-written state.
//
// Migration: readState accepts a v1 document and validates it against the
// same rules (v1 used a subset of these keys). The first scripted write
// normalizes `version` to 2 — lossless, since nothing is dropped. Hand
// repairs stay available: the file remains hand-editable YAML.
//
// Workflow invariants (audit F03) are enforced here, not left to the agent:
// a walk advance past an open checkpoint is rejected; the walk moves one
// step at a time within its change segment — backward moves and multi-step
// jumps are refused unless the same write records a `repairs` entry naming
// the walk field, which is the sanctioned, auditable correction path.
// Append-only checking still cannot detect a rewrite that happened before
// any scripted write; the product never claims tamper-proofing.

/** The schema versions readState accepts. Writes normalize to the newest. */
const SCHEMA_VERSION = 2;
const ACCEPTED_VERSIONS = new Set([1, 2]);

/** ISO date or datetime, e.g. 2026-10-10 or 2026-10-10T12:00:00.000Z. */
const ISO =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/** Top-level schema keys. */
const TOP_KEYS = new Set([
  'version',
  'walk',
  'walk_history',
  'handoff',
  'open_items',
  'assumptions',
  'xray',
  'overruled_stops',
  'checkpoint',
  'flags',
  'repairs',
  'changes',
  'active',
  'releases',
  'maintenance',
  'adopted',
  'revision',
]);

/**
 * Walk stage vocabulary (epic 3): the pack's four stages plus the two entry
 * states — `unwalked` (no walk yet) and `existing` (X-Ray entry).
 */
const STAGES = new Set(['unwalked', 'existing', 'PROJECT', 'FEATURE', 'RELEASE', 'MAINTENANCE']);

/**
 * Inclusive step range per walked stage (GOLDEN_PATH.md:9-64): PROJECT 1-6,
 * FEATURE 7-14, RELEASE 15-18, MAINTENANCE 19-22. The walk is 22 steps.
 */
const STAGE_RANGES = [
  ['PROJECT', 1, 6],
  ['FEATURE', 7, 14],
  ['RELEASE', 15, 18],
  ['MAINTENANCE', 19, 22],
];

/** Last Golden Path step. */
const LAST_STEP = 22;

/** Change record vocabularies (schema v2). */
const CHANGE_KINDS = new Set(['feature', 'bugfix', 'chore']);
const CHANGE_STATUSES = new Set(['planned', 'active', 'blocked', 'done']);
const RELEASE_STATUSES = new Set(['prepared', 'released']);

/** @param {string} reason one-line tail after the `util-state:` prefix */
function fail(reason) {
  throw new Error(`util-state: ${reason}`);
}

/** @param {unknown} v @returns {boolean} */
function isMap(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Reject unknown keys inside a nested map, naming the path.
 * @param {Record<string, unknown>} map
 * @param {string} at path prefix for error messages
 * @param {ReadonlySet<string>} known
 */
function checkKeys(map, at, known) {
  for (const key of Object.keys(map)) {
    if (!known.has(key)) fail(`unknown state key: ${at}.${key}`);
  }
}

/**
 * Calendar-range check behind the ISO regex: real month, a real day for that
 * month (leap years included), clock time within 24h/60m/60s, and a timezone
 * offset of hours within ±14 and minutes within 60.
 * @param {RegExpExecArray} m
 * @returns {boolean}
 */
function isCalendarReal(m) {
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day < 1 || day > daysInMonth) return false;
  if (m[4] !== undefined) {
    const second = m[6] === undefined ? 0 : Number(m[6]);
    if (Number(m[4]) > 23 || Number(m[5]) > 59 || second > 59) return false;
  }
  if (m[7] && m[7] !== 'Z') {
    const offHour = Number(m[7].slice(1, 3));
    const offMinute = Number(m[7].slice(-2));
    if (offHour > 14 || offMinute > 59) return false;
  }  return true;
}

/**
 * @param {unknown} v
 * @param {string} at
 * @returns {string}
 */
function requireIso(v, at) {
  const m = typeof v === 'string' ? ISO.exec(v) : null;
  if (!m || !isCalendarReal(m)) fail(`${at} must be an ISO date`);
  return v;
}

/**
 * @param {unknown} v
 * @param {string} at
 * @returns {string}
 */
function requireText(v, at) {
  if (typeof v !== 'string' || v.trim() === '') fail(`${at} must be a non-empty string`);
  return v;
}

/**
 * Ordering instant for validated ISO text. The schema allows date-only
 * (which JS parses as UTC) and offset-less datetimes (which JS parses in the
 * machine's local zone) — pin both to UTC so ordering is machine-independent.
 * @param {string} s
 * @returns {number}
 */
function instant(s) {
  const m = ISO.exec(s);
  if (!m) return NaN;
  if (m[4] === undefined) return Date.parse(s);
  return Date.parse(m[7] ? s : `${s}Z`);
}

/**
 * A walk entry (current or historical): stage, optional step, updated ISO,
 * and the optional id of the change this segment belongs to (schema v2).
 * @param {unknown} entry
 * @param {string} at
 */
function checkWalkEntry(entry, at) {
  if (!isMap(entry)) fail(`${at} must be a map`);
  checkKeys(entry, at, new Set(['stage', 'step', 'updated', 'change']));
  requireText(entry.stage, `${at}.stage`);
  if (!STAGES.has(/** @type {string} */ (entry.stage))) {
    fail(
      `${at}.stage must be one of ${[...STAGES].join(', ')} — a state predating this vocabulary needs a hand repair of state.yaml before a repairs entry can be recorded`,
    );
  }
  if (entry.step !== undefined) {
    if (
      typeof entry.step !== 'number' ||
      !Number.isInteger(entry.step) ||
      entry.step < 1 ||
      entry.step > LAST_STEP
    ) {
      fail(`${at}.step must be an integer 1-${LAST_STEP}`);
    }
    // The stage follows the step: a walked stage must be the one whose range
    // contains it (GOLDEN_PATH.md's four stages tile steps 1-22 — pinned by
    // the STAGE_RANGES contiguity test).
    const range = STAGE_RANGES.find(([, lo, hi]) => /** @type {number} */ (entry.step) >= lo && /** @type {number} */ (entry.step) <= hi);
    if (range && entry.stage !== range[0]) {
      fail(`${at}.stage must be ${range[0]} for step ${entry.step} (the stage follows the step)`);
    }
  }
  if (entry.change !== undefined) {
    requireText(entry.change, `${at}.change`);
  }
  requireIso(entry.updated, `${at}.updated`);
}

/**
 * @param {unknown} walk
 */
function checkWalk(walk) {
  checkWalkEntry(walk, 'walk');
}

/**
 * @param {unknown} handoff
 */
function checkHandoff(handoff) {
  if (!isMap(handoff)) fail('handoff must be a map');
  checkKeys(handoff, 'handoff', new Set(['path', 'updated']));
  if (handoff.path !== null) requireText(handoff.path, 'handoff.path');
  if (handoff.updated !== null && handoff.updated !== undefined) {
    requireIso(handoff.updated, 'handoff.updated');
  } else if (handoff.updated === undefined) {
    fail('handoff.updated must be an ISO date or null');
  }
}

/**
 * @param {unknown} items
 */
function checkOpenItems(items) {
  if (!Array.isArray(items)) fail('open_items must be a list');
  items.forEach((item, i) => {
    if (!isMap(item)) fail(`open_items[${i}] must be a map`);
    checkKeys(item, `open_items[${i}]`, new Set(['question', 'parked_at', 'resurfaces_at']));
    requireText(item.question, `open_items[${i}].question`);
    requireIso(item.parked_at, `open_items[${i}].parked_at`);
    requireText(item.resurfaces_at, `open_items[${i}].resurfaces_at`);
  });
}

/**
 * Historical walk stages, oldest first: each an entry in walk-entry shape.
 * The list only grows (append-only, enforced at write); entries must be
 * non-decreasing by `updated`, compared as instants so mixed timezone
 * offsets order chronologically, not lexicographically.
 * @param {unknown} history
 */
function checkWalkHistory(history) {
  if (!Array.isArray(history)) fail('walk_history must be a list');
  let prev = NaN;
  history.forEach((entry, i) => {
    checkWalkEntry(entry, `walk_history[${i}]`);
    if (!Number.isNaN(prev) && instant(String(entry.updated)) < prev) {
      fail(`walk_history[${i}].updated must not precede walk_history[${i - 1}].updated (oldest first)`);
    }
    prev = instant(String(entry.updated));
  });
}

/**
 * Assumptions recorded without asking: {made_at, text}.
 * @param {unknown} assumptions
 */
function checkAssumptions(assumptions) {
  if (!Array.isArray(assumptions)) fail('assumptions must be a list');
  assumptions.forEach((item, i) => {
    if (!isMap(item)) fail(`assumptions[${i}] must be a map`);
    checkKeys(item, `assumptions[${i}]`, new Set(['made_at', 'text']));
    requireIso(item.made_at, `assumptions[${i}].made_at`);
    requireText(item.text, `assumptions[${i}].text`);
  });
}

/**
 * X-Ray brief pointer from the existing-repo entry: {path, updated}.
 * @param {unknown} xray
 */
function checkXray(xray) {
  if (!isMap(xray)) fail('xray must be a map');
  checkKeys(xray, 'xray', new Set(['path', 'updated']));
  requireText(xray.path, 'xray.path');
  requireIso(xray.updated, 'xray.updated');
}

/**
 * Overruled/deferred stop decisions (OQ-5, ledger-only ruling): the state
 * index pointing at the ledger's stop_overruled entries. Append-only.
 * @param {unknown} stops
 */
function checkOverruledStops(stops) {
  if (!Array.isArray(stops)) fail('overruled_stops must be a list');
  stops.forEach((item, i) => {
    if (!isMap(item)) fail(`overruled_stops[${i}] must be a map`);
    checkKeys(item, `overruled_stops[${i}]`, new Set(['at', 'condition', 'decision', 'ledger_ts']));
    requireIso(item.at, `overruled_stops[${i}].at`);
    requireIso(item.ledger_ts, `overruled_stops[${i}].ledger_ts`);
    requireText(item.condition, `overruled_stops[${i}].condition`);
    requireText(item.decision, `overruled_stops[${i}].decision`);
  });
}

/**
 * The open Human Checkpoint (step 9): {question, opened}. A single object,
 * not a list — only step 9 raises one, so at most one can be open; removing
 * the key is the user's answer (SKILL.md's Human checkpoints contract).
 * @param {unknown} checkpoint
 */
function checkCheckpoint(checkpoint) {
  if (!isMap(checkpoint)) fail('checkpoint must be a map');
  checkKeys(checkpoint, 'checkpoint', new Set(['question', 'opened']));
  requireText(checkpoint.question, 'checkpoint.question');
  requireIso(checkpoint.opened, 'checkpoint.opened');
}

/**
 * @param {unknown} flags
 */
function checkFlags(flags) {
  if (!isMap(flags)) fail('flags must be a map');
  checkKeys(flags, 'flags', new Set(['degraded_discovery', 'flaky_quarantines']));
  if (typeof flags.degraded_discovery !== 'boolean') {
    fail('flags.degraded_discovery must be a boolean');
  }
  // Item shape is reserved for its owning ticket; only the list is contract.
  if (!Array.isArray(flags.flaky_quarantines)) fail('flags.flaky_quarantines must be a list');
}

/**
 * @param {unknown} repairs
 */
function checkRepairs(repairs) {
  if (!Array.isArray(repairs)) fail('repairs must be a list');
  for (const [i, item] of repairs.entries()) {
    if (!isMap(item)) fail(`repairs[${i}] must be a map`);
    checkKeys(item, `repairs[${i}]`, new Set(['at', 'field', 'from', 'to']));
    requireIso(item.at, `repairs[${i}].at`);
    requireText(item.field, `repairs[${i}].field`);
    // `from` may be "" (a corrected position that was never walked); `to`
    // is the correction itself and must say something.
    if (typeof item.from !== 'string') fail(`repairs[${i}].from must be a string`);
    if (typeof item.to !== 'string' || item.to === '') fail(`repairs[${i}].to must not be empty`);
  }
}

/**
 * A repeatable change: identity, kind, status, and its own record. Completed
 * changes are never removed or rewritten — reopening records the reason and
 * moves the status back (audit F04: durable completion).
 * @param {unknown} changes
 */
function checkChanges(changes) {
  if (!Array.isArray(changes)) fail('changes must be a list');
  /** @type {Set<string>} */
  const ids = new Set();
  for (const [i, item] of changes.entries()) {
    if (!isMap(item)) fail(`changes[${i}] must be a map`);
    checkKeys(
      item,
      `changes[${i}]`,
      new Set(['id', 'kind', 'title', 'status', 'created', 'updated', 'completed', 'reopen_reason', 'block_reason', 'artifacts', 'criteria']),
    );
    requireText(item.id, `changes[${i}].id`);
    if (ids.has(String(item.id))) fail(`changes[${i}] duplicates id: ${item.id}`);
    ids.add(String(item.id));
    if (!CHANGE_KINDS.has(String(item.kind))) {
      fail(`changes[${i}].kind must be one of ${[...CHANGE_KINDS].join(', ')}`);
    }
    requireText(item.title, `changes[${i}].title`);
    if (!CHANGE_STATUSES.has(String(item.status))) {
      fail(`changes[${i}].status must be one of ${[...CHANGE_STATUSES].join(', ')}`);
    }
    requireIso(item.created, `changes[${i}].created`);
    requireIso(item.updated, `changes[${i}].updated`);
    if (item.completed !== undefined) requireIso(item.completed, `changes[${i}].completed`);
    if (item.reopen_reason !== undefined) requireText(item.reopen_reason, `changes[${i}].reopen_reason`);
    if (item.block_reason !== undefined) requireText(item.block_reason, `changes[${i}].block_reason`);
    if (item.artifacts !== undefined) {
      if (!Array.isArray(item.artifacts)) fail(`changes[${i}].artifacts must be a list`);
      item.artifacts.forEach((a, j) => requireText(a, `changes[${i}].artifacts[${j}]`));
    }
    if (item.criteria !== undefined) {
      if (!Array.isArray(item.criteria)) fail(`changes[${i}].criteria must be a list`);
      item.criteria.forEach((c, j) => requireText(c, `changes[${i}].criteria[${j}]`));
    }
  }
}

/**
 * A named release candidate binding completed changes.
 * @param {unknown} releases
 */
function checkReleases(releases) {
  if (!Array.isArray(releases)) fail('releases must be a list');
  /** @type {Set<string>} */
  const ids = new Set();
  for (const [i, item] of releases.entries()) {
    if (!isMap(item)) fail(`releases[${i}] must be a map`);
    checkKeys(item, `releases[${i}]`, new Set(['id', 'changes', 'status', 'created', 'released']));
    requireText(item.id, `releases[${i}].id`);
    if (ids.has(String(item.id))) fail(`releases[${i}] duplicates id: ${item.id}`);
    ids.add(String(item.id));
    if (!Array.isArray(item.changes) || item.changes.length === 0) {
      fail(`releases[${i}].changes must be a non-empty list of change ids`);
    }
    item.changes.forEach((c, j) => requireText(c, `releases[${i}].changes[${j}]`));
    if (!RELEASE_STATUSES.has(String(item.status))) {
      fail(`releases[${i}].status must be one of ${[...RELEASE_STATUSES].join(', ')}`);
    }
    requireIso(item.created, `releases[${i}].created`);
    if (item.released !== undefined) requireIso(item.released, `releases[${i}].released`);
  }
}

/**
 * Event-driven maintenance records (audit F04: maintenance happens when
 * triggered, not as a mandatory stage of every journey).
 * @param {unknown} maintenance
 */
function checkMaintenance(maintenance) {
  if (!Array.isArray(maintenance)) fail('maintenance must be a list');
  for (const [i, item] of maintenance.entries()) {
    if (!isMap(item)) fail(`maintenance[${i}] must be a map`);
    checkKeys(item, `maintenance[${i}]`, new Set(['at', 'kind', 'notes']));
    requireIso(item.at, `maintenance[${i}].at`);
    requireText(item.kind, `maintenance[${i}].kind`);
    requireText(item.notes, `maintenance[${i}].notes`);
  }
}

/**
 * The adopted project context: when the accepted canonical records were
 * adopted, and where they live. Created by adoption (audit F11's substrate);
 * paths are project-relative.
 * @param {unknown} adopted
 */
function checkAdopted(adopted) {
  if (!isMap(adopted)) fail('adopted must be a map');
  checkKeys(adopted, 'adopted', new Set(['at', 'records']));
  requireIso(adopted.at, 'adopted.at');
  if (!isMap(adopted.records)) fail('adopted.records must be a map');
  checkKeys(adopted.records, 'adopted.records', new Set(['project', 'quality', 'architecture', 'decisions']));
  for (const key of Object.keys(adopted.records)) {
    requireText(adopted.records[key], `adopted.records.${key}`);
  }
}

/**
 * Workflow invariants (audit F03), enforced at the single write path.
 * @param {Record<string, unknown>} current the on-disk state (may be absent)
 * @param {Record<string, unknown>} incoming the validated incoming state
 */
function checkTransitions(current, incoming) {
  const currentWalk = /** @type {Record<string, unknown> | undefined} */ (current.walk);
  const incomingWalk = /** @type {Record<string, unknown> | undefined} */ (incoming.walk);
  if (currentWalk === undefined || incomingWalk === undefined) return;
  const currentStep = /** @type {number | undefined} */ (currentWalk.step);
  const incomingStep = /** @type {number | undefined} */ (incomingWalk.step);
  if (incomingStep === undefined || currentStep === undefined) return;

  // The checkpoint gate: a Human Checkpoint blocks the walk advance write.
  if (
    current.checkpoint !== undefined &&
    incomingStep !== currentStep
  ) {
    fail(
      'checkpoint is open — the walk advance is blocked until the checkpoint is answered (an approve closes it; a recorded repair does not bypass it)',
    );
  }

  // One step at a time within the walk's change segment: the trailing
  // history run tagged with the incoming walk's change id (or, untagged,
  // the legacy base segment) is the segment; its last step is `prev`.
  const segmentId = incomingWalk.change;
  /**
   * Segment membership: untagged entries are the legacy base segment;
   * tagged entries belong to their change.
   * @param {Record<string, unknown>} e
   */
  const inSegment = (e) =>
    segmentId === undefined ? e.change === undefined : e.change === segmentId;
  const history = Array.isArray(current.walk_history)
    ? /** @type {Record<string, unknown>[]} */ (current.walk_history)
    : [];
  const segment = history.filter(inSegment);
  if (
    currentWalk.change === segmentId ||
    (currentWalk.change === undefined && segmentId === undefined)
  ) {
    segment.push(currentWalk);
  }
  const prev = segment.length > 0 ? segment[segment.length - 1].step : undefined;

  if (prev === undefined || typeof prev !== 'number') return;
  if (incomingStep === prev || incomingStep === prev + 1) return;

  // The sanctioned exception: a repair entry recorded in the SAME write,
  // naming the walk field, with the correction and its reason.
  const currentRepairs = Array.isArray(current.repairs)
    ? /** @type {unknown[]} */ (current.repairs).length
    : 0;
  const incomingRepairs = Array.isArray(incoming.repairs)
    ? /** @type {unknown[]} */ (incoming.repairs)
    : [];
  const grew =
    incomingRepairs.length > currentRepairs &&
    incomingRepairs
      .slice(currentRepairs)
      .some((r) => String(/** @type {Record<string, unknown>} */ (r).field ?? '').startsWith('walk'));
  if (grew) return;

  fail(
    `walk must move one step at a time (segment is at ${prev}, incoming writes ${incomingStep}) — advance through util-transitions, or record a repairs entry naming the walk field`,
  );
}

/**
 * @param {Record<string, unknown>} state
 * @returns {Record<string, unknown>}
 * @throws {Error} one-line reason on unknown keys, wrong shapes, or a wrong version
 */
function validate(state) {
  if (!isMap(state)) fail('state must be a map');
  for (const key of Object.keys(state)) {
    if (!TOP_KEYS.has(key)) fail(`unknown state key: ${key}`);
  }
  if (typeof state.version !== 'number' || !ACCEPTED_VERSIONS.has(state.version)) {
    fail(`state must carry version ${[...ACCEPTED_VERSIONS].join(' or ')} (read accepts both; writes normalize to ${SCHEMA_VERSION})`);
  }
  if (state.walk !== undefined) checkWalk(state.walk);
  if (state.walk_history !== undefined) {
    checkWalkHistory(state.walk_history);
    if (state.walk !== undefined && state.walk_history.length > 0) {
      // Date granularity: the documented seed writes walk.updated as today's
      // date-only, which must stay valid beside a same-day datetime tail.
      const tail = String(state.walk_history[state.walk_history.length - 1].updated).slice(0, 10);
      if (String(state.walk.updated).slice(0, 10) < tail) {
        fail('walk.updated must not precede the last walk_history entry (the now-line cannot walk backward)');
      }
    }
  }
  if (state.handoff !== undefined) checkHandoff(state.handoff);
  if (state.open_items !== undefined) checkOpenItems(state.open_items);
  if (state.assumptions !== undefined) checkAssumptions(state.assumptions);
  if (state.xray !== undefined) checkXray(state.xray);
  if (state.overruled_stops !== undefined) checkOverruledStops(state.overruled_stops);
  if (state.checkpoint !== undefined) checkCheckpoint(state.checkpoint);
  if (state.flags !== undefined) checkFlags(state.flags);
  if (state.repairs !== undefined) checkRepairs(state.repairs);
  if (state.changes !== undefined) checkChanges(state.changes);
  if (state.active !== undefined) requireText(state.active, 'active');
  if (state.releases !== undefined) checkReleases(state.releases);
  if (state.maintenance !== undefined) checkMaintenance(state.maintenance);
  if (state.adopted !== undefined) checkAdopted(state.adopted);
  if (state.revision !== undefined) {
    if (
      typeof state.revision !== 'number' ||
      !Number.isInteger(state.revision) ||
      state.revision < 0
    ) {
      fail('revision must be a non-negative integer');
    }
  }
  return state;
}

/**
 * @param {string} projectRoot directory containing .mayberry/
 * @returns {Record<string, unknown>}
 */
export function readState(projectRoot) {
  const file = path.join(projectRoot, '.mayberry', 'state.yaml');
  if (!existsSync(file)) fail('no state file at .mayberry/state.yaml (restore it — init refuses an existing .mayberry)');
  return validate(parseYaml(readFileSync(file, 'utf8')));
}

/**
 * The repair log, walk history, and overruled-stops index only grow: for
 * each, the on-disk list must be a prefix of the incoming one — same
 * entries, same order, tail growth only. Dropping the key entirely counts
 * as shrinking to zero.
 * @param {string} projectRoot directory containing .mayberry/
 * @param {string} label list name in errors (e.g. "repairs", "walk_history")
 * @param {unknown[]} incoming the validated incoming list
 */
function checkAppendOnly(projectRoot, label, incoming) {
  const file = path.join(projectRoot, '.mayberry', 'state.yaml');
  if (!existsSync(file)) return;
  const current = validate(parseYaml(readFileSync(file, 'utf8')))[label];
  if (current === undefined) return;
  const stable = (v) => JSON.stringify(v, Object.keys(v).sort());
  const shared = Math.min(current.length, incoming.length);
  for (let i = 0; i < shared; i += 1) {
    // Entries are flat schema-checked maps, so sorted-key JSON is a stable
    // identity; key order on disk vs. in memory must not matter.
    if (stable(current[i]) !== stable(incoming[i])) {
      fail(`${label}[${i}] was rewritten; the ${label} log only grows at the tail`);
    }
  }
  if (incoming.length < current.length) {
    fail(`${label} shrank from ${current.length} to ${incoming.length} entries; the ${label} log only grows`);
  }
}

/**
 * The single write path. Validates, enforces the append-only lists and the
 * workflow invariants against the on-disk state, then lands atomically via
 * temp file + rename. A v1 document is migrated by the write itself: the
 * stored file carries version 2.
 *
 * Every write stamps `revision` (the previous revision + 1), and
 * `options.expectedRevision` turns the write into a compare-and-swap
 * (audit F14): a stale writer whose expected revision no longer matches the
 * on-disk state produces a conflict instead of a lost update.
 * @param {string} projectRoot directory to receive .mayberry/state.yaml
 * @param {Record<string, unknown>} state
 * @param {{expectedRevision?: number}} [options]
 */
export function writeState(projectRoot, state, options = {}) {
  const full = { ...state };
  if (full.flags === undefined) full.flags = { degraded_discovery: false, flaky_quarantines: [] };
  validate(full);
  const file = path.join(projectRoot, '.mayberry', 'state.yaml');
  /** @type {Record<string, unknown>} */
  let current = {};
  if (existsSync(file)) {
    current = validate(parseYaml(readFileSync(file, 'utf8')));
  }
  if (options.expectedRevision !== undefined) {
    const onDisk = typeof current.revision === 'number' ? current.revision : 0;
    if (onDisk !== options.expectedRevision) {
      fail(
        `revision conflict: state is at revision ${onDisk}, the writer expected ${options.expectedRevision} — re-read state.yaml and reapply the change`,
      );
    }
  }
  checkTransitions(current, full);
  checkAppendOnly(projectRoot, 'repairs', Array.isArray(full.repairs) ? full.repairs : []);
  checkAppendOnly(projectRoot, 'walk_history', Array.isArray(full.walk_history) ? full.walk_history : []);
  checkAppendOnly(projectRoot, 'overruled_stops', Array.isArray(full.overruled_stops) ? full.overruled_stops : []);
  const dir = path.join(projectRoot, '.mayberry');
  mkdirSync(dir, { recursive: true });
  // Temp file + rename: a crash mid-write cannot leave a half-written
  // state.yaml that fails validation on every later read or write. The tmp
  // name is pid-suffixed so two writers cannot share one tmp file.
  const target = path.join(dir, 'state.yaml');
  const tmp = `${target}.${process.pid}.tmp`;
  full.version = SCHEMA_VERSION;
  full.revision = (typeof current.revision === 'number' ? current.revision : 0) + 1;
  writeFileSync(tmp, serializeYaml(full));
  renameSync(tmp, target);
}
