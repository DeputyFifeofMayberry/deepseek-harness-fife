<a id="w32"></a>

## W32 — Hosting, Environments and Operational Responsibility

**Purpose:** Choose where work runs and make operational obligations explicit.

**Use when:** A hosted service, new platform, meaningful environment change, or uncertain storage/exposure. **Skip when:** A local-only change has no new runtime or operational boundary.

| Prompt | Your response |
|---|---|
| **Workload and simplest fit**<br>Local/static/platform/functions/container/VM choice; offline/device access, background work, users and constraints. |  |
| **Runtime and data map**<br>What runs where; ephemeral vs persistent paths; database/uploads/cache/backups; external dependencies. |  |
| **Responsibility ownership**<br>Provider promise vs builder configuration/verification; named owner for runtime, data, access, network, cost and failure. |  |
| **Names, access and TLS**<br>Account/environment, public/private endpoints, DNS records, hostname/certificates, MFA and least privilege. |  |
| **Environment and candidate**<br>Dev/test/staging/prod differences; source/build/artifact/config/instance identity; no production secrets in clients. |  |
| **Capacity and cost**<br>Measured bottleneck; concurrency/downstream limits; fixed/usage charges; budget alerts vs enforced controls. |  |
| **Evidence and recovery**<br>Restart/redeploy persistence, logs, critical path, restore, prior configuration; [W17](W17_Release_Readiness.md#w17)–[W19](W19_Migration_Backup_and_Recovery_Plan.md#w19) links. |  |
| **Proposed changes and authorization**<br>Exact resources/actions, recurring obligations, safe reversal, approvals, remaining gates and owner. |  |

**Close the worksheet when:** The environment, public exposure, data durability, provider/builder responsibilities, costs, permissions and recovery are explicit; relevant checks are evidenced or gated; provisioning and release require separate actual authorization.

**Use with:** Chapter 14; [P34](../prompts/P34.md#p34); [D25](../DECISION_AIDS.md#d25); [C22](../QUICK_REFERENCE_CARDS.md#c22); [W16](W16_Security_Escalation_and_Threat_Check.md#w16)/W18/W19.
