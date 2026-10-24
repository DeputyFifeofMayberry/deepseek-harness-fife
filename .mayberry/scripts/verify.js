import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendLedger } from './util-ledger.js';

// Verification runner (audit F01): one check is a criterion id, a command,
// and an expectation. The runner executes the command, guards against
// vacuous suites (zero discovery), compares the expectation, captures the
// raw output to a durable evidence file, and records the ledger entry —
// result-dependent validation then refuses a pass without proof. The
// candidate fingerprint (git HEAD + dirty-state hash) rides in the notes so
// resume can classify proof reusable or stale (audit F14).
//
// Narrow by design: command + expected match + counts. Tier floors beyond
// the recorded tier, protected-evidence immutability, and hook wiring stay
// with the verification/enforcement epics.

/** Output markers of a suite that ran nothing. */
const ZERO_DISCOVERY = [
  /no tests?\b/i,
  /0 tests\b/i,
  /0 passing\b/i,
  /nothing to run/i,
  /no tests found/i,
];

/**
 * The candidate fingerprint: git HEAD plus the dirty-state hash, or a
 * stable non-git marker. `.mayberry/` is excluded from the dirty state —
 * the pack's own records (state writes, evidence files) are not candidate
 * changes, and counting them would invalidate every proof on completion.
 * @param {string} projectRoot
 * @returns {string}
 */
export function fingerprint(projectRoot) {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });
  if (head.status !== 0) return 'nogit';
  const dirty = spawnSync(
    'git',
    ['status', '--porcelain', '--', '.', ':(exclude).mayberry'],
    {
      cwd: projectRoot,
      encoding: 'utf8',
    },
  );
  const tree = createHash('sha256')
    .update(dirty.stdout ?? '')
    .digest('hex')
    .slice(0, 12);
  return `${head.stdout.trim()}+${tree}`;
}

/**
 * Run one check and record it.
 * @param {string} projectRoot directory containing .mayberry/
 * @param {{criterion: string, command: string, expect?: string, tier?: string,
 *          change?: string, retries?: number}} spec
 * @returns {{pass: boolean, attempts: number, evidencePath: string, reason: string}}
 */
export function runCheck(projectRoot, spec) {
  const criterion = String(spec.criterion ?? '').trim();
  const command = String(spec.command ?? '').trim();
  if (criterion === '') fail('verify: a check needs --criterion');
  if (command === '') fail('verify: a check needs --command');
  const expect = spec.expect !== undefined ? String(spec.expect) : '';
  const tier = String(spec.tier ?? 'moderate');
  const change = spec.change !== undefined ? String(spec.change) : '';
  const retries = Number.isInteger(spec.retries) && spec.retries > 0 ? spec.retries : 0;

  const fp = fingerprint(projectRoot);
  const stamp = new Date().toISOString();
  const attemptsAllowed = retries + 1;
  /** @type {{output: string, exit: number} | undefined} */
  let last;
  let attempts = 0;
  let pass = false;
  let reason = '';
  while (attempts < attemptsAllowed) {
    attempts += 1;
    const run = spawnSync(command, {
      cwd: projectRoot,
      encoding: 'utf8',
      shell: true,
    });
    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
    const exit = run.status ?? 1;
    last = { output, exit };
    reason = judge(output, exit, expect);
    if (reason === '') {
      pass = true;
      break;
    }
  }

  // Durable raw output: the proof the ledger entry points at.
  const evidenceDir = path.join(projectRoot, '.mayberry', 'evidence');
  mkdirSync(evidenceDir, { recursive: true });
  const safeCriterion = criterion.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 60);
  const evidenceName = `${stamp.replace(/[:.]/g, '-')}-${safeCriterion}.txt`;
  const evidencePath = path.join(evidenceDir, evidenceName);
  writeFileSync(
    evidencePath,
    [
      `# change=${change || '(none)'} criterion=${criterion} fingerprint=${fp}`,
      `# command: ${command}`,
      expect !== '' ? `# expected: ${expect}` : '# expected: exit 0, non-vacuous output',
      `# exit: ${last?.exit} attempts: ${attempts} zero-discovery-guard: on`,
      '',
      last?.output ?? '',
    ].join('\n'),
  );

  appendLedger(projectRoot, {
    ts: stamp,
    change: 'verification',
    check: criterion,
    tier,
    result: pass ? 'pass' : 'fail',
    evidence: `.mayberry/evidence/${evidenceName}`,
    notes: [
      change !== '' ? `change=${change}` : 'change=(none)',
      `attempts=${attempts}`,
      `exit=${last?.exit}`,
      `fingerprint=${fp}`,
      `expected=${expect === '' ? '(exit 0 + non-vacuous)' : expect}`,
      `reason=${reason === '' ? 'met' : reason}`,
    ].join('; '),
  });

  return { pass, attempts, evidencePath: `.mayberry/evidence/${evidenceName}`, reason: reason === '' ? 'met' : reason };
}

/**
 * The failure verdict for one run, or '' when the check is met.
 * @param {string} output
 * @param {number} exit
 * @param {string} expect
 * @returns {string}
 */
function judge(output, exit, expect) {
  if (exit !== 0) return `command exited ${exit}`;
  if (output.trim() === '') return 'zero discovery: the command produced no output';
  for (const marker of ZERO_DISCOVERY) {
    if (marker.test(output)) return `zero discovery: output matches ${marker}`;
  }
  if (expect !== '') {
    if (expect.startsWith('re:')) {
      let re;
      try {
        re = new RegExp(expect.slice(3));
      } catch {
        return `bad expectation regex: ${expect.slice(3)}`;
      }
      if (!re.test(output)) return `expected /${expect.slice(3)}/ not found in output`;
    } else if (!output.includes(expect)) {
      return `expected text not found in output: ${expect}`;
    }
  }
  return '';
}

/**
 * @param {string} reason
 * @returns {never}
 */
function fail(reason) {
  throw new Error(reason.startsWith('verify:') ? reason : `verify: ${reason}`);
}
