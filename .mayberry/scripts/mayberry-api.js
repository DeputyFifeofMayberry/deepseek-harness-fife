#!/usr/bin/env node
// The installed runtime entry (audit F02): every state, ledger, checkpoint,
// and link operation the skill documents runs through this file after init
// stages it to .mayberry/scripts/. It must work with nothing but the staged
// files and Node — no dev checkout, no npm install. Helpers load dynamically
// so a missing staged module yields an actionable one line instead of a
// stack trace. Usage goes to stdout with exit 1; errors are one line on
// stderr with exit 1; success is one line on stdout (state get and ledger
// read print JSON) with exit 0.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const USAGE = `usage: node mayberry-api.js <command> [args]
commands:
  state validate                      validate .mayberry/state.yaml
  state get                           print the validated state as JSON
  state write                         read a full state document as JSON from stdin and write it
  checkpoint close                    remove the open checkpoint key (the user's answer)
  ledger append --change C --result R [--check K] [--tier T] [--evidence E]
                 [--evidence-before B] [--evidence-after A] [--notes N] [--ts TS]
  ledger read [--change C]            print ledger entries as JSON ("no ledger yet" when absent)
  links check <file>                  resolve every relative Markdown link in <file>
  change start --kind feature|bugfix|chore --title "..." [--id C-001]
  change complete [--id C-001]        mark the active (or named) change done;
                                      gated on its declared criteria's proof
  change check [--id C-001]           read-only: criteria verdicts + orphan runs
  change criteria --changes "a,b" [--id C-001]   declare the criteria to prove
  change revise [--id C-001] --reason "..."   watermark: older proof goes stale
  change block --reason "..."         block the active change with a reason
  change reopen --id C-001 --reason "..."
  change list                         print the change records as JSON
  advance                             move the active change's walk one step
  verify run --criterion ID --command "CMD" [--expect TEXT|re:PATTERN]
             [--tier moderate] [--change C-001] [--retries N]
  resume [--id C-001]                 classify the change's proof reusable vs
                                      stale against the current candidate
  release record --changes C-001,C-002 [--id R-001]
  release mark --id R-001             mark a prepared candidate released
  maintenance record --kind K --notes "..."
  state migrate                       read (v1 or v2) and rewrite as v2
  state write --expect-revision N     compare-and-swap: refuse when the file
                                      is not at revision N (audit F14)`;

/**
 * Load a staged sibling helper, or fail with the repair line. The diagnosis
 * is the contract: a missing helper is named, and the fix is re-running
 * mayberry init — improvised raw writes are never the happy path.
 * @param {string} name
 * @returns {Promise<Record<string, unknown>>}
 */
async function helper(name) {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), name);
  if (!existsSync(file)) {
    fail(`the runtime helper ${name} is missing beside mayberry-api.js — run "mayberry init" in this project to restore the staged scripts`);
  }
  return import(`./${name}`);
}

/**
 * @param {string} reason one-line message
 * @returns {never}
 */
function fail(reason) {
  console.error(`mayberry-api: ${reason}`);
  process.exit(1);
}

/**
 * @param {string[]} argv
 * @returns {{positionals: string[], values: Record<string, string | boolean>}}
 */
function parse(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      change: { type: 'string' },
      check: { type: 'string' },
      tier: { type: 'string' },
      result: { type: 'string' },
      evidence: { type: 'string' },
      'evidence-before': { type: 'string' },
      'evidence-after': { type: 'string' },
      notes: { type: 'string' },
      ts: { type: 'string' },
      id: { type: 'string' },
      kind: { type: 'string' },
      title: { type: 'string' },
      reason: { type: 'string' },
      changes: { type: 'string' },
      criterion: { type: 'string' },
      command: { type: 'string' },
      expect: { type: 'string' },
      retries: { type: 'string' },
      'expect-revision': { type: 'string' },
    },
  });
  return { positionals, values };
}

/**
 * @param {Record<string, string | boolean>} values
 * @param {string[]} names
 */
function requireValues(values, names) {
  for (const name of names) {
    if (typeof values[name] !== 'string' || /** @type {string} */ (values[name]).trim() === '') {
      fail(`--${name} is required here`);
    }
  }
}

/**
 * Resolve every relative .md link in a Markdown file against its own
 * directory; unresolved targets are the output, so an installed agent (or
 * the generation rule) can repair them.
 * @param {string} file
 * @returns {string[]} unresolved target texts
 */
function checkLinks(file) {
  if (!existsSync(file)) fail(`no such file: ${file}`);
  const text = readFileSync(file, 'utf8');
  const base = path.dirname(path.resolve(file));
  /** @type {string[]} */
  const missing = [];
  for (const m of text.matchAll(/\]\(([^)\s]+\.md)(#[^)\s]*)?\)/g)) {
    const target = m[1];
    if (/^https?:\/\//i.test(target)) continue;
    const resolved = path.resolve(base, decodeURI(target));
    if (!existsSync(resolved)) missing.push(target);
  }
  return missing;
}

/**
 * @param {string[]} argv
 */
async function main(argv) {
  const [command, ...rest] = argv;
  if (!command || command === 'help') {
    console.log(USAGE);
    process.exit(1);
  }
  const { positionals, values } = parse(rest);

  if (command === 'state') {
    const [op] = positionals;
    const state = await helper('util-state.js');
    if (op === 'validate') {
      state.readState(process.cwd());
      console.log('state ok');
      return;
    }
    if (op === 'get') {
      console.log(JSON.stringify(state.readState(process.cwd()), null, 2));
      return;
    }
    if (op === 'write') {
      const input = readFileSync(0, 'utf8');
      let document;
      try {
        document = JSON.parse(input);
      } catch {
        fail('stdin must be one JSON state document');
      }
      /** @type {{expectedRevision?: number}} */
      const writeOpts = {};
      if (typeof values['expect-revision'] === 'string') {
        const wanted = Number(values['expect-revision']);
        if (!Number.isInteger(wanted) || wanted < 0) {
          fail('--expect-revision must be a non-negative integer');
        }
        writeOpts.expectedRevision = wanted;
      }
      state.writeState(process.cwd(), document, writeOpts);
      const after = state.readState(process.cwd());
      console.log(`state written at revision ${after.revision}`);
      return;
    }
    if (op === 'migrate') {
      // Read accepts v1; the write normalizes to the current schema.
      const current = state.readState(process.cwd());
      state.writeState(process.cwd(), current);
      console.log(`state at version ${state.readState(process.cwd()).version}`);
      return;
    }
    fail(`unknown state op: ${op ?? '(none)'} — expected validate, get, write, or migrate`);
  }

  if (command === 'change') {
    const [op] = positionals;
    const transitions = await helper('util-transitions.js');
    if (op === 'start') {
      requireValues(values, ['kind', 'title']);
      const started = transitions.startChange(process.cwd(), {
        kind: /** @type {string} */ (values.kind),
        title: /** @type {string} */ (values.title),
        id: typeof values.id === 'string' ? values.id : undefined,
      });
      console.log(`change ${started.id} started`);
      return;
    }
    if (op === 'complete') {
      const done = transitions.completeChange(process.cwd(), {
        id: typeof values.id === 'string' ? values.id : undefined,
      });
      console.log(
        done.gated
          ? `change ${done.id} done — every declared criterion holds executed proof`
          : `change ${done.id} done (no criteria declared — completion ungated; tier floors arrive with tiering)`,
      );
      return;
    }
    if (op === 'check') {
      const checked = transitions.checkChange(process.cwd(), {
        id: typeof values.id === 'string' ? values.id : undefined,
      });
      const bad = checked.verdicts.filter((v) => v.status !== 'pass');
      for (const verdict of checked.verdicts) {
        console.log(
          `${verdict.status.toUpperCase()} ${verdict.criterion}: ${verdict.detail}`,
        );
      }
      for (const orphan of checked.orphans) {
        console.log(`ORPHAN run recorded for undeclared criterion: ${orphan}`);
      }
      if (bad.length > 0 || checked.orphans.length > 0) process.exit(1);
      console.log(checked.verdicts.length === 0 ? 'no criteria declared — nothing to check' : 'criteria met');
      return;
    }
    if (op === 'revise') {
      requireValues(values, ['reason']);
      const revised = transitions.reviseChange(process.cwd(), {
        id: typeof values.id === 'string' ? values.id : undefined,
        reason: /** @type {string} */ (values.reason),
      });
      console.log(`change ${revised.id} revised at ${revised.at} — earlier proof for it is stale`);
      return;
    }
    if (op === 'block') {
      requireValues(values, ['reason']);
      const blocked = transitions.blockChange(process.cwd(), {
        reason: /** @type {string} */ (values.reason),
      });
      console.log(`change ${blocked.id} blocked`);
      return;
    }
    if (op === 'reopen') {
      requireValues(values, ['id', 'reason']);
      transitions.reopenChange(process.cwd(), {
        id: /** @type {string} */ (values.id),
        reason: /** @type {string} */ (values.reason),
      });
      console.log(`change ${values.id} active again`);
      return;
    }
    if (op === 'list') {
      const state = await helper('util-state.js');
      const current = state.readState(process.cwd());
      console.log(JSON.stringify({ active: current.active ?? null, changes: current.changes ?? [] }, null, 2));
      return;
    }
    if (op === 'criteria') {
      const set = String(values.changes ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      if (set.length === 0) fail('--changes must list the criterion ids, comma-separated');
      const declared = transitions.setCriteria(process.cwd(), {
        id: typeof values.id === 'string' ? values.id : undefined,
        criteria: set,
      });
      console.log(`change ${declared.id} declares ${declared.criteria.length} criterion: ${declared.criteria.join(', ')}`);
      return;
    }
    fail(`unknown change op: ${op ?? '(none)'} — expected start, complete, check, criteria, revise, block, reopen, or list`);
  }

  if (command === 'advance') {
    const transitions = await helper('util-transitions.js');
    const moved = transitions.advance(process.cwd());
    console.log(`walk at step ${moved.step}`);
    return;
  }

  if (command === 'verify') {
    const [op] = positionals;
    if (op !== 'run') fail(`unknown verify op: ${op ?? '(none)'} — expected run`);
    requireValues(values, ['criterion', 'command']);
    const verify = await helper('verify.js');
    const outcome = verify.runCheck(process.cwd(), {
      criterion: /** @type {string} */ (values.criterion),
      command: /** @type {string} */ (values.command),
      expect: typeof values.expect === 'string' ? values.expect : undefined,
      tier: typeof values.tier === 'string' ? values.tier : undefined,
      change: typeof values.change === 'string' ? values.change : undefined,
      retries: typeof values.retries === 'string' ? Number(values.retries) : undefined,
    });
    console.log(
      `${outcome.pass ? 'PASS' : 'FAIL'} ${values.criterion} after ${outcome.attempts} attempt(s): ${outcome.reason} — evidence: ${outcome.evidencePath}`,
    );
    if (!outcome.pass) process.exit(1);
    return;
  }

  if (command === 'resume') {
    // Resume validity (audit F14): compare the candidate fingerprint now
    // against the fingerprints in the active change's proof.
    const { fingerprint } = await helper('verify.js');
    const state = await helper('util-state.js');
    const transitions = await helper('util-transitions.js');
    const current = state.readState(process.cwd());
    const id = typeof values.id === 'string' ? values.id : current.active;
    if (!id) fail('no active change and no id given');
    const checked = transitions.checkChange(process.cwd(), { id: String(id) });
    const now = fingerprint(process.cwd());
    const entries = await helper('util-ledger.js');
    let ledgerEntries = [];
    try {
      ledgerEntries = entries.readLedger(process.cwd());
    } catch {
      ledgerEntries = [];
    }
    const proofFingerprints = new Set(
      ledgerEntries
        .filter((e) => e.change === 'verification' && e.result === 'pass' && String(e.notes ?? '').includes(`change=${id}`))
        .map((e) => String(e.notes).match(/fingerprint=([^;]+)/)?.[1] ?? '')
        .filter((fp) => fp !== ''),
    );
    // Equal fingerprints mean the candidate did not change since proof was
    // recorded — a non-git project's stable marker counts like any other.
    const drift = proofFingerprints.size === 0
      ? 'no passing proof recorded'
      : proofFingerprints.has(now)
        ? 'none'
        : 'candidate changed since proof was recorded';
    console.log(`resume: change ${id} — criteria ${checked.verdicts.filter((v) => v.status === 'pass').length}/${checked.verdicts.length} proven; fingerprint ${now}; drift: ${drift}`);
    for (const verdict of checked.verdicts.filter((v) => v.status !== 'pass')) {
      console.log(`STALE ${verdict.criterion}: ${verdict.detail}`);
    }
    return;
  }

  if (command === 'release') {
    const [op] = positionals;
    const transitions = await helper('util-transitions.js');
    if (op === 'record') {
      const changes = String(values.changes ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      if (changes.length === 0) fail('--changes must name the done changes, comma-separated');
      const recorded = transitions.recordRelease(process.cwd(), {
        changes,
        id: typeof values.id === 'string' ? values.id : undefined,
      });
      console.log(`release ${recorded.id} prepared`);
      return;
    }
    if (op === 'mark') {
      requireValues(values, ['id']);
      transitions.markReleased(process.cwd(), { id: /** @type {string} */ (values.id) });
      console.log(`release ${values.id} released`);
      return;
    }
    fail(`unknown release op: ${op ?? '(none)'} — expected record or mark`);
  }

  if (command === 'maintenance') {
    const [op] = positionals;
    if (op !== 'record') fail(`unknown maintenance op: ${op ?? '(none)'} — expected record`);
    requireValues(values, ['kind', 'notes']);
    const transitions = await helper('util-transitions.js');
    transitions.recordMaintenance(process.cwd(), {
      kind: /** @type {string} */ (values.kind),
      notes: /** @type {string} */ (values.notes),
    });
    console.log('maintenance recorded');
    return;
  }

  if (command === 'checkpoint') {
    const [op] = positionals;
    if (op !== 'close') {
      fail(`unknown checkpoint op: ${op ?? '(none)'} — expected close`);
    }
    const state = await helper('util-state.js');
    const current = state.readState(process.cwd());
    if (current.checkpoint === undefined) {
      fail('no open checkpoint — the checkpoint key is absent, nothing to close');
    }
    delete current.checkpoint;
    state.writeState(process.cwd(), current);
    console.log('checkpoint closed');
    return;
  }

  if (command === 'ledger') {
    const [op] = positionals;
    const ledger = await helper('util-ledger.js');
    if (op === 'append') {
      requireValues(values, ['change', 'result']);
      ledger.appendLedger(process.cwd(), {
        ts: typeof values.ts === 'string' ? values.ts : new Date().toISOString(),
        change: /** @type {string} */ (values.change),
        check: typeof values.check === 'string' ? values.check : '',
        tier: typeof values.tier === 'string' ? values.tier : '',
        result: /** @type {string} */ (values.result),
        evidence: typeof values.evidence === 'string' ? values.evidence : '',
        evidence_before: typeof values['evidence-before'] === 'string' ? values['evidence-before'] : '',
        evidence_after: typeof values['evidence-after'] === 'string' ? values['evidence-after'] : '',
        notes: typeof values.notes === 'string' ? values.notes : '',
      });
      console.log('ledger appended');
      return;
    }
    if (op === 'read') {
      let entries;
      try {
        entries = ledger.readLedger(process.cwd());
      } catch {
        console.log('no ledger yet');
        return;
      }
      if (typeof values.change === 'string') {
        entries = entries.filter((e) => e.change === values.change);
      }
      console.log(JSON.stringify(entries, null, 2));
      return;
    }
    fail(`unknown ledger op: ${op ?? '(none)'} — expected append or read`);
  }

  if (command === 'links') {
    const [op, file] = positionals;
    if (op !== 'check' || !file) {
      fail('usage: links check <file>');
    }
    const missing = checkLinks(file);
    if (missing.length > 0) {
      for (const target of missing) {
        console.error(`mayberry-api: unresolved link target: ${target} (from ${file})`);
      }
      process.exit(1);
    }
    console.log('links ok');
    return;
  }

  fail(`unknown command: ${command}`);
}

main(process.argv.slice(2)).catch((error) => {
  const reason = error instanceof Error ? error.message : String(error);
  fail(reason.split(/\r?\n/)[0]);
});
