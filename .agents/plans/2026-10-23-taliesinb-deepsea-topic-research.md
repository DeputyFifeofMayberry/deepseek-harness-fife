# Taliesinb deepsea-harness topic branch research, 2026-10-23

Evaluation of every topic branch on github.com/taliesinb/deepsea-harness for cherry-picking into fife master.
Fife master here means origin/master 9bb49850ac5e20c6c0185c8f9d57eb5ba6249816.
This was research only; nothing in the working tree changed except this file.
All numbers come from git diff and git log on shallow refs under refs/remotes/taliesinb/, per the reproduction section.

## Executive verdict

The 23 branches form one integration pyramid, not 23 independent patches.
Everything sits on a common base of two commits.
Six branches are strict layers of one model-and-billing stack.
In order: base, pi-ai-oauth-routes, billing-metadata, settings-models-signins, model-catalog-capabilities.
The top two layers are model-picker-sections and model-picker-recent.
A second stack builds workspace relocation: session-relocation, workspace-destinations, command-session.
A third is two branches: input-triggers, trigger-label-segments.
All branches share merge-base 5badb15009ae1756c3afe0ae0cef1faafc290ccc, the upstream dsh-0.2.1-alpha.1 release commit.
Every topic therefore predates about 1707 fife commits, which changed 6008 files.

Cherry-pick now, in this order.
These are small, self-contained, and their target files barely drifted in fife.

1. fix-scroll-pin (31164b5f8b), 117 added lines, drift 1 line. WebKit viewport pin for the Web shell.
2. fix-open-state-watchdog (1feca9278f), 167 added lines, drift 14 lines elsewhere in the file. Kills permanent Loading-history states.
3. fix-scheduler-symbol (e46c2684e1), one line. Fife still has the un-interned Symbol at packages/core/tools/src/index.ts line 481.
4. provider-errors, split: take 36193de8ce now; rework 95cac559be against fife's pi-ai 1.1.0 patch separately.
5. modal-width (01f1196976) and command-claim-decoration (d4727ff282), tiny UI QoL with small drift.
6. darwin-web-shortcuts (2b1a557f31), 20 lines, zero fife drift on its paths.
7. launch-token (4b02515dd9), 27 lines. The target file drifted 208 lines, but the four-line concept still ports.

Take with rework, queued after the above.

1. title-slug (f1adf84868, 346150f28d). Good QoL. Fife's session-title-llm/src/index.ts drifted 101+/119-, so hunks need hand-alignment.
2. embed-session (d4f6fbb2a6), 315 lines across ui-layout, store, connection. Moderate drift.
3. input-triggers (6f2a9263c1) plus trigger-label-segments (f68c0029b8) as a pair. Fife also modified ui-input-trigger, so medium conflict.
4. session-relocation (5 commits, 3589 added lines), then workspace-destinations and command-session if the sidebar UI is wanted.

Skip for now, with reasons.

1. topic/base as a whole. 2432c3d9cb is DeepSea branding fife does not want. Take b35a6e1a41 only as a dependency of the OAuth stack.
2. deepsea-home (d9921f8487). Repoints the default home to ~/.deepsea/release. Pure fork identity, contradicts fife branding.
3. The full model-picker and billing stack as-is. About 4100 lines over 6 layers, on pi-ai 0.87.1 while fife runs 1.1.0. Stage it instead.

One surprise that revises the earlier assessment: the fix topics are cheap wins, as assumed.
The honest correction concerns the model-picker UI layers taken alone.
model-picker-recent and model-picker-sections sit 16 to 17 commits deep in a stack whose bottom half is their real prerequisite.
Fife's copies of the two UI packages drifted heavily: ui-settings-models 1959+/384-, ui-model-selection 315+/114-.
Picking them without the stack underneath produces code that compiles against nothing.
The real prize is the llm core of the billing stack, and it needs a deliberate port to pi-ai 1.1.0 rather than a cherry-pick.

## Dependencies and staging

Verified stacking, each layer's parent being the previous tip.
Chain one: base (b35a6e1a41), pi-ai-oauth-routes (6802d1df3c), billing-metadata (9ae136450b), settings-models-signins (6d69f0e586).
Then model-catalog-capabilities (b6b2504fb3), model-picker-sections (cd306ff22d), model-picker-recent (d59d68dd82).
Chain two: base, session-relocation (ab84fc58c4), workspace-destinations (f077471f31), command-session (7ea7a6ed88).
Chain three: base, input-triggers (6f2a9263c1), trigger-label-segments (f68c0029b8).
Every other branch is a singleton on base.

Only one branch genuinely needs base's code.
Grepping each topic's own added lines, base commits excluded, for previewNotice or DSH_PROVIDER_SIMULATOR finds zero references.
The only exception is pi-ai-oauth-routes.
Its packages/llm/llm-pi-ai/src/oauth.ts imports simulatedUrl from @deepseek-ai/dsh-llm.
Its tests/oauth-routes.spec.ts stubs DSH_PROVIDER_SIMULATOR.
simulatedUrl is introduced by b35a6e1a41 in packages/llm/llm/src/provider-simulation.ts.
Inference: the runtime OAuth routes would work without base only if simulatedUrl is inlined or stubbed; the tests would not pass.
All other topics can be cherry-picked alone and will compile without base.

Suggested staging if the billing and model stack is pursued.
Step one: port the OAuth routes plus billing-metadata's subscription-usage.ts and pricing.ts onto fife's pi-ai 1.1.0, taking b35a6e1a41.
The topic renames login.ts to oauth.ts, and fife's catalog.ts, config.ts, adapter.ts and login.ts all drifted.
This layer is a re-expression rather than a pick.
Step two: model-catalog-capabilities, small at 178 lines and mostly additive in session-controller/src/catalog.ts and types.ts.
Step three: re-express the settings-models and model-picker UI layers on fife's own drifted copies.

Both trees are on Session format V4.
SESSION_FORMAT_VERSION = 4 at 5badb15009ae and at 9bb49850 in packages/session/session-format-catalog.
The relocation stack's V4 re-expression therefore matches fife's storage format.
The obstacle is fife's own rework of session-persistence-jsonl/src/index.ts.
It changed 242 lines and added an apply() plugin entry plus a p-limit listing limiter.
The topic's relocate() method knows none of that and must be ported by hand.

## Topic sections

Sizes are git diff --shortstat of each topic's own changes.
Singleton topics are measured from base tip b35a6e1a41; stacked topics incrementally from their parent tip.
Drift is git diff --shortstat 5badb15009ae..fife-master restricted to the topic's own touched paths.
Drift ranking: none, low under 100 lines, medium 100 to 500, high over 500 or structural rework.

### fix-scroll-pin

Pins the Web document scroll at (0, 0).
WebKit focus-reveal scrolls shift the whole window in a Safari standalone web app, and the shift sticks over a blank band.
Adds packages/client/web/src/scroll-pin.ts (33 lines, new) and an overflow clip on html and body in packages/client/web/src/base.css.
Wires it into boot.ts, with a jsdom spec.
Commit 31164b5f8b. 5 files, 117 insertions.
Fife drift on these paths: 1 file, 1 line, the mountClient call signature in boot.ts, outside every hunk.
Dependencies: none. Verdict: take now, the cleanest branch in the set.

### fix-open-state-watchdog

A history open that failed with a local, non-Remote error left openState at loading forever, because the retain path swallows the rethrow.
Both open and the live fold now fold the failure into openState error with a gateway/internal RemoteFailure and console.error.
A watchdog in packages/api/session-controller/src/client/sessions/session.ts reissues the follow once.
Its constants OPEN_STALL_WARN_MS and OPEN_STALL_RESTART_MS are 15 and 30 seconds.
Commit 1feca9278f. 2 files, 167+/5-.
Fife drift: 2 files, 14+/1-, all in a subagents.prompt requestId line far from doOpen.
Dependencies: none. Verdict: take now; direct user-visible reliability fix.

### fix-scheduler-symbol

Interns TOOL_RUNTIME_SCHEDULER with Symbol.for in packages/core/tools/src/index.ts.
A twice-loaded dsh-tools, lib copy plus src copy, then still finds the scheduler.
The commit message documents a real failure where every tool call died reading 'prepare' of undefined.
Commit e46c2684e1. 1 file, 1+/1-.
Fife still has Symbol('@deepseek-ai/dsh-tools.scheduler') at line 481.
Dependencies: none. Verdict: take now; one line, zero risk.
Whether fife's build can actually double-load the package is unverified, so this is protective rather than a known fife bug.

### provider-errors

Commit 36193de8ce extends classifyPiAiError in packages/llm/llm-pi-ai/src/stream.ts.
Z.ai empty-balance HTTP 429 business code 1113 becomes quota exceeded via /"code"\s*:\s*"?1113\b/.
Gemini API_KEY_INVALID and API_KEY_EXPIRED become AUTH.
The ChatGPT Plan wording "hit your ... usage limit" becomes RATE_LIMIT.
It also widens isQuotaExceededError in packages/llm/llm/src/error.ts to match "balance is exhausted" wording.
Commit 95cac559be stops Anthropic SDK clients from falling back to the local Anthropic configuration.
A Kimi Code header-auth route would otherwise send Anthropic refresh tokens to Kimi's host.
It patches pi-ai 0.87.1 to disable _shouldResolveDefaultCredentials, with an 83-line test.
Total 11 files, 198+/17-.
Fife's copies of both touched functions match the topic's pre-image line for line, so 36193de8ce applies directly.
The surrounding drift of 4691 lines across the 11 paths is README i18n, the pi-ai patch file, and pnpm-lock.
Dependencies: none.
Verdict: take 36193de8ce now, adapting the two new spec files to fife's test layout.
Rework 95cac559be against fife's patches/@earendil-works__pi-ai@1.1.0.patch, which has no such hook today.
First verify the 1.1.0 SDK still has that fallback.

### title-slug

Adds style: 'natural' | 'slug' to both LLM title providers in packages/session/session-title-llm/src/index.ts.
Slug mode prompts for a lowercase hyphenated identifier and slugifies the output: NFKD, marks stripped, word cap.
Commit f1adf84868.
Commit 346150f28d adds one retry after 1.5 seconds.
A provider that cannot serve two concurrent requests then fails into a retry instead of the fallback title.
7 files, 95+/4-.
Fife drift: 6 files, 311+/236-, including restructured config validation and README section renames.
The SessionTitleLlmConfig fields the topic extends still exist in fife under the same names.
Dependencies: none. Verdict: take with rework; real QoL for the sidebar, moderate hunk alignment.

### session-relocation

Five commits adding relocation of stored sessions between workspaces.
3d9e061b09: session.move and moveMany, with relocate() on the persistence seam and rename-first crash safety into session-move-backups.
6cf622f5fa: POST /api/session.import receiving an export ZIP.
fad31ae0a1: session-persistence/stored event; import seeds the projection cache.
46825aa4ce: move refusal names the work it would interrupt.
ab84fc58c4: session.copy.
New files: packages/api/session-controller/src/move.ts (452 lines), import.ts (515), copy.ts (137), shape.ts (82).
Plus tests and bilingual docs.
68 files, 3589+/42-.
Fife drift on the touched paths: 44 files, 6716+/3487-, the worst in the set.
It concentrates in session-persistence-jsonl and session-controller, which fife changed across 41 files, 2629+ lines.
Session format matches: V4 on both sides.
Dependencies: none on base code, zero base-symbol references.
Verdict: take with rework, storage seam first.
The move, import and copy files are mostly additive, so the port concentrates in relocate() and the session-controller wiring.

### workspace-destinations

Six commits on top of session-relocation.
d7002cbef8: unary workspace.list plus additive sidebar seats.
5f699107df: Menu rows gain a muted trailing detail; a portal Menu can match its anchor width.
04563421db: no text selection or native drag from the session tree.
1846c8f23d: Move to… and Rehome… from the sidebar.
5b5560efda: Copy to….
f077471f31: contributed destinations, one tree-shaped dialog for local and remote targets.
40 files, 1706+/81-. Fife drift: 31 files, 3322+/789-, high.
Dependencies: session-relocation.
Verdict: skip for now. Large UI churn on a sidebar fife has modified; revisit after session-relocation lands.

### command-session

One commit 7ea7a6ed88 on workspace-destinations.
A command configured to run in a New Session engages that new browser session instead of leaving it unselected.
19 files, 291+/16-. Fife drift: 14 files, 4842+/2754-, high.
Dependencies: workspace-destinations. Verdict: skip for now, same reasoning as its parent.

### model-picker-recent

Tip of the billing stack, 17 own commits plus base.
Its own increment d59d68dd82 adds recent model and effort choices under the root menu.
New packages/client/ui-model-selection/src/client/recent.ts, 80 lines, plus ModelSelect.tsx wiring and specs.
14 files, 397+/6-. Fife drift on those paths: 8 files, 253+/101-, medium.
The real dependency is the whole stack beneath it.
Verdict: skip until the stack's llm core is ported; then take, as the cheapest of the five UI layers.

### model-picker-sections

One increment cd306ff22d on model-catalog-capabilities.
Provider and access-kind sections, kind and capability filters, and older models in the picker.
New packages/client/ui-model-selection/src/client/route-sections.ts, 275 lines, plus MenuGroup changes in ui-primitives.
15 files, 1017+/96-. Fife drift: 7 files, 222+/100-, medium.
Fife separately modified ModelSelect.tsx by 89 lines.
Dependencies: model-catalog-capabilities and below.
Verdict: skip until the stack is staged in; then re-express against fife's ModelSelect.

### model-catalog-capabilities

One increment b6b2504fb3 on settings-models-signins.
Model capabilities and route billing kind in the session-controller model catalog, published from llm.
Touch packages/api/session-controller/src/catalog.ts (plus 27) and types.ts (plus 37).
19 files, 178+/33-. Fife drift: 19 files, 1651+/303-, medium-high, but the hunks are mostly additive type and catalog surface.
Dependencies: the billing stack below.
Verdict: take as step two of the staged stack, not standalone.

### billing-metadata

Six commits on pi-ai-oauth-routes.
f6b36c30c1: catalog list prices on resolved model info.
36ed65536d: OAuth subscription usage through the owning adapter.
1165485e04: a past response's recorded cost through the owning adapter.
ec83ea4010: Codex subscription usage.
c026f909af: route billing metadata in packages/llm/llm/src/types.ts.
Adds catalogProvider, auth kind subscription or api-key or local, LlmSubscriptionAccount, and listPricing.
9ae136450b: docs.
New packages/llm/llm-pi-ai/src/subscription-usage.ts, 286 lines.
It reads api.anthropic.com/api/oauth/usage and profile, and chatgpt.com/backend-api/wham/usage.
New pricing.ts, 118 lines.
17 files, 1111+/15-.
Fife has no subscription usage anywhere: zero matches for Subscription in packages/llm/llm/src/types.ts.
This is entirely new capability for fife's pi-ai usage.
Drift: 13 files, 740+/101-.
Dependencies: pi-ai-oauth-routes and base's simulatedUrl.
Verdict: take with rework; the highest-value content in the fork, ported as the llm core of the staging plan on pi-ai 1.1.0.

### pi-ai-oauth-routes

Four commits.
7b9a785ef5: isolated <provider>-oauth routes for subscription sign-in.
4b49c06855: classify OAuth routes as subscription or pay-per-use.
f726e4610c: cancelling a sign-in withdraws the racing manual-code question.
6802d1df3c: sign-in pages through the provider simulator.
Renames packages/llm/llm-pi-ai/src/login.ts to oauth.ts, 96 lines changed, and reworks catalog.ts by 56 lines.
15 files, 558+/101-.
Fife drift: 9 files, 299+/69-.
Fife's login.ts still exists under the old name with its own additions: models.ts, provider-data, discovery, auth.ts.
Dependencies: base, verified by the simulatedUrl import in src/oauth.ts and the env stub in tests/oauth-routes.spec.ts.
Verdict: take with rework as step one of the staged stack.
The rename and fife's parallel llm-pi-ai growth make a direct pick impossible.
The isolated-route design is still what the rest of the stack builds on.

### settings-models-signins

Four commits on billing-metadata.
08b3a203fb: sign-in routes show their account, no key field.
a06ef1e270: the add card does not offer dormant sign-in routes.
e33ece9b67: Add API key, and Details on sign-in cards.
6d69f0e586: API keys, Plans and Local sections.
28 files, 857+/205-, dominated by packages/client/ui-settings-models/src/client/ModelsSection.tsx, 391 lines changed.
Fife drift: 25 files, 1810+/330-, high.
Dependencies: billing-metadata.
Verdict: take with rework late in the staged stack, once the llm core lands and usage data exists to display.

### input-triggers

Generalizes the hardcoded '/' and '@' input triggers to plugin-defined trigger characters.
InputTriggerHit.trigger widens from that union to string in packages/client/ui-conversation/src/client/contract/input.ts.
Lexicons then key on arbitrary triggers.
Commit 6f2a9263c1. 19 files, 108+/55-.
Fife drift: 14 files, 636+/158-, medium.
Fife independently added locale files and controller changes in ui-input-trigger.
Dependencies: none.
Verdict: take with rework only if a concrete plugin trigger need exists; it is enabling infrastructure for trigger-label-segments.

### trigger-label-segments

One increment f68c0029b8 on input-triggers.
Candidate label segments can carry dim pieces, exported as InputTriggerLabelSegment with MenuView rendering.
8 files, 72+/10-. Fife drift: 4 files, 13+/5-, low.
Dependencies: input-triggers.
Verdict: same as its parent; cheap once input-triggers is in.

### embed-session

Adds ?embed=<sessionId> presentation.
The frame drops the left column: zero track, inert toggle, data-embedded.
The embedded id is the initial selection, and open() refuses another root Session.
The token-exchange redirect keeps non-token query parameters.
Touch packages/client/connection/src/browser-auth.ts, packages/client/store/src/page-mode.ts (new), and ui-layout AppFrame.
Commit d4f6fbb2a6. 21 files, 315+/26-.
Fife drift: 8 files, 378+/87-, medium, including fife's own browser-auth rework of 137 lines.
Dependencies: none.
Verdict: take with rework if embedding sessions in other surfaces is a fife use case; otherwise skip.

### launch-token

DSH_LAUNCH_TOKEN, at least 32 base64url characters, becomes the process launch token instead of a random one.
This serves launchers that start the server on demand.
Implemented as configuredLaunchToken() in packages/client/connection/src/browser-auth.ts.
Commit 4b02515dd9. 2 files, 27+/1-.
Fife drift: 2 files, 208+/28-.
Fife's processLaunchToken at line 61 still creates a random token, exactly as the topic's pre-image does.
The four-line change ports directly with a moved anchor.
Dependencies: none.
Verdict: take now with a trivial rebase, or fold into fife's connection work.

### modal-width

Modal gains a width prop sized in CSS px and capped at the viewport.
It applies style width min(px, 100%) in packages/client/ui-primitives/src/Modal.tsx.
Commit 01f1196976. 5 files, 23+/5-.
Fife drift: 3 files, 36+/26-, low.
Dependencies: none. Verdict: take now, one-hunk UI QoL.

### command-claim-decoration

An empty-argument claim submit, meaning whitespace after the token and no attachments, opens the command's decoration like the bare form.
Without it the host runs the command with empty arguments.
In packages/client/ui-commands/src/client/service.ts.
Commit d4727ff282. 3 files, 31+/2-.
Fife drift: 3 files, 50+/3-, low.
Dependencies: none.
Verdict: take now; small and behavior-safe, since arguments and attachments still go to the host.

### darwin-web-shortcuts

A desktop-marked document with no desktop bridge falls back to the Web shortcut runtime instead of failing startup.
The case is a native web view wrapping the Web app.
In packages/client/shortcuts/src/client/index.ts.
Commit 2b1a557f31. 5 files, 20+/7-.
Fife drift on these paths: none.
Dependencies: none.
Verdict: take now. Only relevant if fife ships such a wrapper, but the fallback is strictly more permissive and costless.

### deepsea-home

DeepSea's default home becomes ~/.deepsea/release.
Touch packages/util/home-paths/src/index.ts, agent-instructions display-path handling, and tests.
Commit d9921f8487. 5 files, 27+/22-.
Fife drift: 4 files, 1542+/226- on those paths.
Dependencies: none.
Verdict: skip.
Fork identity that contradicts fife's own branding, and its stated goal is keeping upstream ~/.dsh wording intact for future merges.

### topic/base

Two commits.
2432c3d9cb adds previewNotice, default false, to the ui-settings-models onboarding config.
No DeepSea variant then shows the upstream preview notice. 9 files, 38+/9-.
b35a6e1a41 adds provider simulation.
DSH_PROVIDER_SIMULATOR points model traffic and OAuth sign-in pages at a local simulator, so real credentials are never sent.
Implemented as packages/llm/llm/src/provider-simulation.ts, 171 lines, plus a hook in packages/llm/llm/src/index.ts and tests.
6 files, 264+/2-.
Fife drift on base paths: 11 files, 1186+/456-, mostly README i18n.
Dependencies: none. Other branches need it only through b35a6e1a41's simulatedUrl, for pi-ai-oauth-routes and its descendants.
Verdict: skip 2432c3d9cb permanently. Take b35a6e1a41 only when staging the OAuth and billing stack.

## How to reproduce

Fetch, once per branch, at depth 40:
git fetch --depth=40 https://github.com/taliesinb/deepsea-harness topic/base:refs/remotes/taliesinb/topic-base
and the same for each of the 22 remaining topic/<name> branches into refs/remotes/taliesinb/<name>.
Also fetch integration/dsh-v0.2.1-alpha.1 and master at depth 1 and 2.

Merge-base and counts:
git merge-base taliesinb/<topic> 687f282e8625c6b8d11ff58211a90524be2e4317.
It prints 5badb15009ae1756c3afe0ae0cef1faafc290ccc for every topic.
git rev-list --count 5badb15009ae..taliesinb/<topic> and git log --oneline 5badb15009ae..taliesinb/<topic>.

Own-change sizes:
git diff --shortstat b35a6e1a41..taliesinb/<topic> for singletons.
git diff --shortstat taliesinb/<parent>..taliesinb/<topic> for stacked layers.

Drift:
git diff --name-only <own range> to list the topic's files, then
git diff --shortstat 5badb15009ae..9bb49850ac5e20c6c0185c8f9d57eb5ba6249816 -- <those paths>.

Base dependency, per topic, excluding base commits by using the own ranges:
git diff <range> | grep -E '^\+' | grep -cE 'previewNotice|DSH_PROVIDER_SIMULATOR'.

Two environment notes.
The repository's upstream/master tracking ref moved to 22ddee3792 during the deepening fetch.
Upstream advanced past 687f282e86 since the task data was gathered.
All comparisons here pin the task's SHA explicitly.
The local upstream history was shallow at the rc.2 boundary, which made git merge-base fail.
git fetch --depth=700 upstream master repaired it.

## Unverified

Whether fife's build can actually double-load dsh-tools, so that fix-scheduler-symbol fixes a live fife bug.
The fix itself is verified applicable and harmless.
Whether the Anthropic SDK credential fallback that 95cac559be patches exists in the pi-ai 1.1.0 dependency.
Fife's 1.1.0 patch lacks the hook, but the SDK version bundled by 1.1.0 was not inspected.
Whether the topic stack's OAuth flow ports to pi-ai 1.1.0 without API changes.
Fife's login.ts already imports AuthEvent and AuthPrompt from 1.1.0, which is encouraging but incomplete evidence.
Whether upstream master has since absorbed any of these topics. The advanced upstream tip 22ddee3792 was not examined.
No builds, tests, or cherry-pick rehearsals were run. Every verdict is from diff and history reading only.
