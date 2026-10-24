<a id="w14"></a>

## W14 — Change Review Checklist

**Purpose:** Review the complete artifact against intent.

**Use when:** A meaningful diff or final integrated candidate. **Skip when:** Quick work may use a compact diff-and-behavior review.

| Prompt | Your response |
|---|---|
| **Scope and baseline**<br>Requirement/brief, reviewed revision and changed files; preserve unrelated work. |  |
| **Correctness and failures**<br>Expected behavior, edge cases, errors, concurrency and state/data ownership. |  |
| **Architecture and dependencies**<br>Unjustified complexity, boundaries, new packages, dead code and duplication. |  |
| **Security and compatibility**<br>Trust/permission/data/logging changes; APIs, formats and supported platforms. |  |
| **Tests and static checks**<br>Actual results/discovery; assertions, fixture/snapshot/recording, skips, selection, tolerance, baseline and CI/gate diffs; independent approval of changed expectations; unrun evidence. |  |
| **Findings and disposition**<br>Location, evidence, impact; fix/block/accept/separate; owner and rationale. |  |
| **Final recheck and records**<br>Post-fix diff/tests; updated canonical documents; staged review/commit scope. |  |

**Close the worksheet when:** AI findings are verified claims, and the post-fix candidate is the one accepted.

**Use with:** Chapter 11; [P17](../prompts/P17.md#p17).
