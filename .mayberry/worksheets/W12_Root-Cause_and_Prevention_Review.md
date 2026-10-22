<a id="w12"></a>

## W12 — Root-Cause and Prevention Review

**Purpose:** Explain a serious/recurrent failure without oversimplifying it.

**Use when:** A significant incident, repeated bug or a failed safeguard. **Skip when:** An isolated low-impact bug can keep this in [W11](W11_Bug_Investigation.md#w11).

| Prompt | Your response |
|---|---|
| **Incident and evidence**<br>Link reproduction/timeline and exact affected versions. |  |
| **Causal mechanism**<br>What condition produced the failure and what test/intervention supports it? |  |
| **Contributing conditions**<br>Timing, environment, data, dependencies and human/system interactions. |  |
| **Detection and escape**<br>Why did existing tests, review or monitoring not expose it? |  |
| **Correction versus mitigation**<br>What removes the cause, what only limits impact, and what remains unknown? |  |
| **Prevention with proportionality**<br>A test/control/documentation change tied to recurrence, not generic retraining. |  |
| **Owner and effectiveness check**<br>Who acts; when/under what event; what evidence will show improvement? |  |

**Close the worksheet when:** Every prevention action addresses a supported mechanism and has a verification path.

**Use with:** Chapters 9/16; [P14](../prompts/P14.md#p14)/P23.
