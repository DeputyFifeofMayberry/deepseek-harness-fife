import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Ledger owner: append-only JSONL at .mayberry/ledger.jsonl. Every appended
// line carries every field in FIELDS order; the core fields are required
// non-empty on every entry, unknown fields are rejected before anything is
// written, and validation is result-dependent (audit F01): a `verification`
// entry additionally requires `check`, and a passing one also requires
// `tier` and `evidence` — a pass without proof does not append.

/**
 * @typedef {Object} LedgerEntry
 * @property {string} ts
 * @property {string} change
 * @property {string} check
 * @property {string} tier
 * @property {string} result
 * @property {string} evidence
 * @property {string} evidence_before
 * @property {string} evidence_after
 * @property {string} notes
 */

/** Field order and completeness for every appended line. @type {ReadonlyArray<keyof LedgerEntry>} */
const FIELDS = [
  'ts',
  'change',
  'check',
  'tier',
  'result',
  'evidence',
  'evidence_before',
  'evidence_after',
  'notes',
];

/** Fields every entry must carry non-empty. @type {ReadonlyArray<keyof LedgerEntry>} */
const REQUIRED = ['ts', 'change', 'result'];

/**
 * Result-dependent floors (audit F01): a ledger record that reports success
 * must carry proof. A passing `verification` entry requires its check, tier,
 * and evidence; a failing one still names the check it attempted. Other
 * entry kinds keep the core floors only.
 * @param {Partial<LedgerEntry>} entry
 * @returns {ReadonlyArray<keyof LedgerEntry>}
 */
function requiredFor(entry) {
  const required = [...REQUIRED];
  if (entry.change === 'verification') {
    required.push('check');
    if (entry.result === 'pass') required.push('tier', 'evidence');
  }
  return required;
}

/** ISO 8601 UTC timestamp; millis optional (millisecond form is canonical). */
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

/**
 * Append one entry. Optional fields are written as empty strings; the file is
 * only ever appended to.
 * @param {string} projectRoot directory containing .mayberry/
 * @param {Partial<LedgerEntry>} entry
 * @throws {Error} one-line reason; nothing is appended on rejection
 */
export function appendLedger(projectRoot, entry) {
  for (const key of Object.keys(entry)) {
    if (!FIELDS.includes(/** @type {keyof LedgerEntry} */ (key))) {
      throw new Error(`util-ledger: unknown ledger field: ${key}`);
    }
  }
  for (const field of requiredFor(entry)) {
    const value = entry[field];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`util-ledger: ledger entry requires non-empty ${field}`);
    }
  }
  if (!ISO_UTC.test(entry.ts)) {
    throw new Error(
      `util-ledger: ts must be an ISO 8601 UTC timestamp (got ${entry.ts})`,
    );
  }
  const line = {};
  for (const field of FIELDS) {
    line[field] = entry[field] ?? '';
  }
  const dir = path.join(projectRoot, '.mayberry');
  mkdirSync(dir, { recursive: true });
  appendFileSync(path.join(dir, 'ledger.jsonl'), `${JSON.stringify(line)}\n`);
}

/**
 * @param {string} projectRoot directory containing .mayberry/
 * @returns {LedgerEntry[]}
 */
export function readLedger(projectRoot) {
  const file = path.join(projectRoot, '.mayberry', 'ledger.jsonl');
  const text = readFileSync(file, 'utf8');
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line));
}
