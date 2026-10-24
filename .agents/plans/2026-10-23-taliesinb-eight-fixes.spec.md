# Spec: Import the eight cherry-pick-ready fixes from the taliesinb fork

Status: published 2026-10-23 as the umbrella issue #10 on the fife tracker; seams confirmed by user.

## Problem Statement

Everyday use of the harness keeps hitting small, known rough edges: the Web page sometimes sticks
shifted sideways so part of the UI is unreachable; a session sometimes sits on "Loading history"
forever; provider errors like Z.ai's out-of-credit code 1113 surface as opaque failures; dialog
cards can overflow small windows; submitting a slash-command with no argument dead-ends instead of
opening its form; opening a desktop-only document in the browser does nothing; a scheduling handoff
silently misses its match when code loads twice; and a launched app page has no way to trust the
process that opened it.

## Solution

Import the eight corresponding fixes from taliesinb/deepsea-harness, each already built and tested
upstream, as small independent commits on fife master in drift-safe order, re-expressing the hunks
where fife's code has moved.

## User Stories

1. As a Web user, I want the page view pinned so it cannot stick shifted, so that all controls stay reachable.
2. As a Web user, I want a stuck "Loading history" state to recover on its own, so that I never have to reload to see my session.
3. As a Z.ai user, I want out-of-credit errors explained in plain language, so that I know to top up instead of retrying.
4. As a desktop user, I want dialog cards sized to my window, so that buttons and text are never cut off.
5. As a command user, I want an argument-less slash-command to open its fill-in dialog, so that I can complete it instead of restarting.
6. As a browser user, I want a desktop-marked document to fall back to the Web runtime, so that the document still opens.
7. As a session owner, I want the scheduler handoff to work even when the tools package loads twice, so that scheduled follow-ups fire.
8. As an app user, I want the launched page to verify its opening process by a one-time token, so that the connection is trustworthy.
9. As a reviewer, I want each fix as its own commit with its source SHA recorded, so that I can audit or revert any single fix.
10. As a maintainer, I want upstream tests to travel with each pick, so that the fixes stay verified on fife's code.
11. As a maintainer, I want the second provider-errors commit excluded, so that fife's newer pi-ai adapter patch is not regressed by hunks written for the old one.
12. As a documentation reader, I want doc updates to accompany any fix that changed documented behavior, so that docs stay canonical.

## Implementation Decisions

- One commit per fix, cherry-picked in drift order: scroll-pin (31164b5f8b), open-state-watchdog
  (1feca9278f), scheduler-symbol (e46c2684e1), provider-errors first commit only (36193de8ce),
  modal-width (01f1196976), command-claim-decoration (d4727ff282), darwin-web-shortcuts
  (2b1a557f31), launch-token (4b02515dd9).
- Hunks are hand-aligned where fife drifted; the scheduler-symbol pick is expected to be a one-line
  substitution at the current call site.
- No session-format change, no SESSION_FORMAT_VERSION bump; each fix is reviewed for
  persistence-type acknowledgement before landing, and provider-errors gets a snapshot because
  classification changes user-visible error text.
- Docs touched by a topic land with it; all written content is English only.

## Testing Decisions

- Test external behavior only: each pick's upstream spec runs unmodified where possible against the
  package's public seam, the highest existing seam in every case; no new seams.
- Where a fix changes transcript-visible output (provider-errors), a keyless recorded-session
  snapshot captures it, matching the snapshots tree's existing conventions.
- Gates per the pre-push policy: focused package tests, typecheck, build:check, doc-sync, and
  test:snapshot replay; no full-suite default.

## Out of Scope

The three taliesinb stacks (billing/OAuth/model-picker, workspace relocation, input triggers),
topic/base, the rework items (title-slug, embed-session, session-relocation), the other
fork-network fixes from the earlier scan (output-limit continuation, repeat-tool cap, heartbeat,
drive-root), and syncing upstream's newer tip (22ddee3792).

## Further Notes

Source SHAs and per-topic drift numbers live in
.agents/plans/2026-10-23-taliesinb-deepsea-topic-research.md. All topics share merge-base 5badb1500
(upstream dsh-0.2.1-alpha.1).
