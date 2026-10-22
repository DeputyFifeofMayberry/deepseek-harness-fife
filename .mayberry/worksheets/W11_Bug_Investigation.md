<a id="w11"></a>

## W11 — Bug Investigation

**Purpose:** Test explanations before fixing symptoms.

**Use when:** A meaningful or repeated failure. **Skip when:** A trivial fully understood correction needs only a short evidence note.

| Prompt | Your response |
|---|---|
| **Expected / actual / impact**<br>Describe the difference and whether harm is ongoing. |  |
| **Reproduction and environment**<br>Exact steps, version, fixture, frequency and preserved evidence. |  |
| **Baseline and changes**<br>Last known good; code, dependency, configuration, data and platform changes. |  |
| **Hypotheses and ranking**<br>Competing explanations; evidence for/against; cheapest safe discriminating test. |  |
| **Experiment log**<br>Prediction → one controlled intervention → result → interpretation. |  |
| **Cause or bounded mitigation**<br>Explain causal evidence; label remaining uncertainty honestly. |  |
| **Fix, regression and cleanup**<br>Smallest adequate correction, original-case check, related tests and instrumentation removal. |  |

**Close the worksheet when:** Evidence is sufficient to choose the smallest appropriate fix or bounded mitigation, the original failure and regression checks are defined, and any unconfirmed explanation remains labeled as a hypothesis.

**Use with:** Chapter 9; [P13](../prompts/P13.md#p13)/P14.
