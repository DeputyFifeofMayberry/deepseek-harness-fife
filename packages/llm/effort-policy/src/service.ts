/**
 * `ctx.effortPolicy`: the Cordis adapter over the portable decision core. State
 * lives in the `effort` session projection, so it is durable and per-Session by
 * construction; this service decides and writes the request effort.
 * @module @deepseek-ai/dsh-effort-policy/service
 */

import { Service, type Context } from '@deepseek-ai/cordis'
import { ReasoningEffortId, type LlmCallConfig } from '@deepseek-ai/dsh-llm'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Session } from '@deepseek-ai/dsh-session'
import type { ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import { Config, resolveConfig, type ResolvedConfig } from './config.ts'
import { classifyOutcome, verifierIdentity, type ToolOutcome } from './evidence.ts'
import {
  decisionRecord,
  effortProjectionDefinition,
  effortStateSchema,
  type EffortStateRecord,
} from './events.ts'
import { applyEvidence, decide, operationStart } from '@mayberry/effort-policy-core'
import type {
  Decision,
  DelegationOperation,
  EffortCapability,
  EffortLevel,
  EffortState,
} from '@mayberry/effort-policy-core'
import './protocol.ts'

/** Raised when a dependency the policy needs is absent or failed. */
export class EffortPolicyUnavailableError extends Error {
  override name = 'EffortPolicyUnavailableError'
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Reasoning-effort policy for the Agents created under this context. */
    effortPolicy: EffortPolicy
  }
}

/**
 * The starting choice an Agent declares for its own requests, before any
 * durable record exists: a delegated operation, a level it was created with, or
 * an exact effort the delegating tool was told to use.
 */
export interface StartChoice {
  /** Level the Agent starts at. */
  readonly level?: EffortLevel
  /** Exact effort the Agent was created with; written verbatim and never escalated. */
  readonly exact?: string
}

/**
 * The three automatic levels, for callers that accept raw picker values.
 */
const LEVELS: readonly EffortLevel[] = ['low', 'standard', 'deep']

/**
 * The directory one tool call ran in: the call's own `workdir` when it names
 * one, otherwise the Session's. Identity needs it because the same command in
 * another directory is another check.
 * @param session - the Session whose tool call settled.
 * @param args - the call's parsed arguments.
 * @returns the directory the call ran in, empty when neither source names one.
 */
function workingDirectoryOf(session: Session, args: unknown): string {
  if (typeof args === 'object' && args !== null && 'workdir' in args && typeof args.workdir === 'string') {
    return args.workdir
  }
  return session.header.cwd ?? ''
}

/**
 * Serialize one call's arguments for pattern matching and identity, dropping the
 * keys the deployment declares presentation-only. A label is not part of what the
 * call does, so a check keeps its identity when the caller retitles it.
 * @param args - the call's parsed arguments.
 * @param ignored - argument keys to remove.
 * @returns the JSON text the classifier matches and the identity embeds.
 */
function argumentsTextOf(args: unknown, ignored: readonly string[]): string {
  if (typeof args !== 'object' || args === null || Array.isArray(args) || ignored.length === 0) {
    return JSON.stringify(args ?? {})
  }
  return JSON.stringify(Object.fromEntries(
    Object.entries(args).filter(([key]) => !ignored.includes(key)),
  ))
}

/**
 * Whether a raw picker value names one of the automatic levels.
 * @param value - raw effort string from a client or configuration.
 * @returns whether the value is a level.
 */
export function isEffortLevel(value: string): value is EffortLevel {
  return (LEVELS as readonly string[]).includes(value)
}

/**
 * Owns the deployment configuration, the durable record, and the request write.
 *
 * A disabled policy is inert: it registers the service so a tool can detect that
 * the deployment knows about the feature, and it writes nothing. All wiring is
 * installed only when the services it needs are composed.
 */
export class EffortPolicy extends Service {
  /** Loader-validated configuration shape. */
  static Config = Config

  private readonly resolved: ResolvedConfig

  /** Per-Session observation order, shared by failures and passes. */
  private readonly sequences = new WeakMap<Session, number>()

  /** Workspace mutation counter; shared across Sessions because they share the workspace. */
  private revision = 0

  /**
   * Per-Agent request listeners this policy attached. A dependency replacement
   * unloads this generation before the replacement runs, so one entry per Agent
   * is the complete ownership record: the entry is released on Agent disposal,
   * on generation unload, and on policy disposal.
   */
  private readonly attached = new Map<Agent, () => void>()

  /**
   * The last state this policy read successfully, per Session. When the durable
   * record cannot be read, the level it already applied is the only claim that
   * can still be honored; falling back to the configured base would silently
   * lower a raised level.
   */
  private readonly lastKnown = new WeakMap<Session, EffortStateRecord>()

  /** The root context: strict get reports only services with an active provider. */
  private root: Context



  /**
   * @param ctx - the context this service is mounted in.
   * @param config - loader-validated configuration.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'effortPolicy')
    this.root = ctx.root
    this.resolved = resolveConfig(config)
    ctx.inject(['sessionProjections'], (child) => {
      child.sessionProjections.register(effortProjectionDefinition)
    })
    ctx.effect(() => () => {
      for (const dispose of this.attached.values()) dispose()
      this.attached.clear()
    })
    ctx.inject(['llm', 'tools', 'agents'], (child) => {
      // One request listener per Agent. The generation that owns the entry is
      // also the one that releases it: an Agent disposal, this injected child's
      // unload, or the policy's own disposal.
      const attach = (agent: Agent): void => {
        if (this.attached.has(agent)) return
        const listener = async (
          _payload: { readonly agent: Agent },
          next: () => Promise<LlmCallConfig>,
        ): Promise<LlmCallConfig> => {
          const proposed = await next()
          return this.applyTo(agent.session, proposed, this.startFor(agent))
        }
        this.attached.set(agent, agent.ctx.on('agent/request', listener, { prepend: true }))
      }
      child.on('tools/result', (exec, result) => {
        if (!this.resolved.enabled || exec.agent === undefined) return
        this.observe(exec.agent.session, exec.name, exec.arguments, result)
      })
      // A re-entered generation must serve Agents that already exist, and an
      // Agent created later must be attached exactly once.
      for (const agent of child.agents.list()) attach(agent)
      child.on('agent/created', ({ agent }) => { attach(agent) })
      child.on('agent/disposed', ({ agent }) => {
        const dispose = this.attached.get(agent)
        if (dispose === undefined) return
        dispose()
        this.attached.delete(agent)
      })
      // This generation owns every listener it added: a dependency replacement
      // disposes this child, and its listeners must go with it.
      child.effect(() => () => {
        for (const [agent, dispose] of this.attached) {
          dispose()
          this.attached.delete(agent)
        }
      })
    })
  }

  /** Whether this deployment may change a request's effort. */
  get enabled(): boolean {
    return this.resolved.enabled
  }

  /** The configured level a session runs at before any pick, pin, or escalation. */
  get baseLevel(): EffortLevel {
    return this.resolved.baseLevel
  }

  /** The validated configuration, for callers that classify evidence. */
  get configuration(): ResolvedConfig {
    return this.resolved
  }

  /**
   * Apply the policy to one proposed request. Provider and model are always
   * preserved; only the effort may change, and only when the policy is enabled
   * and the route advertises a vocabulary.
   * @param session - the Session making the request.
   * @param proposed - the configuration the loop would dispatch.
   * @param start - the Agent's own starting choice, used only while the Session
   *   has recorded none of its own.
   * @returns the configuration to dispatch.
   */
  async applyTo(session: Session, proposed: LlmCallConfig, start?: StartChoice): Promise<LlmCallConfig> {
    if (!this.resolved.enabled) return proposed
    // Required durable state is validated before any early return, so an
    // unavailable projection can never be mistaken for "nothing to do".
    const state = this.stateFrom(this.retainedRecord(session), start)
    const capability = await this.capability(proposed.provider, proposed.model)
    // A route that advertises no reasoning is a successful discovery with no
    // effort to write; leave the request exactly as proposed.
    if (capability.efforts.length === 0) return proposed
    const decision = decide(capability, state)
    if (decision.effort === undefined) {
      // A cleared or untouched decision must not inherit the previous request's
      // explicit effort: each step seeds from the logged header, so a stale
      // `max` would survive recovery forever. Dropping the field restores the
      // adapter's own default.
      const { reasoningEffort: _inherited, ...rest } = proposed
      return rest
    }
    return { ...proposed, reasoningEffort: ReasoningEffortId(decision.effort) }
  }

  /**
   * Whether a delegation's declared effort respects its operation minimum. The
   * minimum constrains the three automatic level names; any other advertised
   * effort is written verbatim, because only the adapter knows whether it is a
   * capability above or below that level.
   * @param operation - the delegation's declared operation.
   * @param rawEffort - the effort the caller selected.
   * @returns whether the delegating tool may accept the value.
   */
  meetsOperationMinimum(operation: DelegationOperation, rawEffort: string): boolean {
    if (!isEffortLevel(rawEffort)) return true
    return LEVELS.indexOf(rawEffort) >= LEVELS.indexOf(operationStart(operation))
  }

  /**
   * The observed state for one Session, read from its durable record.
   * @param session - the Session whose state is read.
   * @returns the current state as the core consumes it.
   */
  stateOf(session: Session): EffortState {
    return this.stateFrom(this.retainedRecord(session))
  }

  /**
   * Compose the state a decision runs on. A recorded pick or base wins over
   * anything the Agent was created with; the Agent's own start fills the gap a
   * freshly created child leaves.
   * @param record - the Session's durable record.
   * @param start - the Agent's starting choice, when it declares one.
   * @returns the state the core consumes.
   */
  private stateFrom(record: EffortStateRecord, start?: StartChoice): EffortState {
    const base = record.base ?? start?.level ?? this.resolved.baseLevel
    const exact = record.exact ?? start?.exact
    return {
      base,
      ...exact === undefined ? {} : { exact },
      ...record.openFailure === undefined ? {} : { openFailure: record.openFailure },
    }
  }

  /**
   * Record a user pick. A level value replaces the base and clears any exact
   * effort; any other value is an exact effort written verbatim and never
   * escalated.
   * @param session - the Session the pick applies to.
   * @param rawEffort - the effort value the user selected.
   * @throws when `rawEffort` is empty.
   */
  setBase(session: Session, rawEffort: string): void {
    if (rawEffort.length === 0) throw new Error('effort-policy: setBase requires a non-empty effort')
    const record: EffortStateRecord = isEffortLevel(rawEffort)
      ? { base: rawEffort }
      : { ...this.retainedRecord(session), exact: rawEffort }
    session.append('effort/decision', decisionRecord(record, isEffortLevel(rawEffort) ? 'base' : 'exact-base'))
  }

  /**
   * Fold one settled tool result into the workspace revision or the open
   * escalation, appending a decision record only when the state changes.
   * @param session - the Session whose tool call settled.
   * @param tool - registered tool name.
   * @param args - the call's parsed arguments.
   * @param result - the settled result.
   */
  observe(session: Session, tool: string, args: unknown, result: ToolExecutionResult): void {
    if (!this.resolved.enabled) return
    const text = result.content
      .map(block => block.type === 'text' ? block.text : '')
      .join('\n')
    const failureCode = result.isError ? result.error.info?.code : undefined
    const outcome: ToolOutcome = {
      tool,
      argumentsText: argumentsTextOf(args, this.resolved.ignoredArgumentKeys),
      workingDirectory: workingDirectoryOf(session, args),
      text,
      isError: result.isError,
      ...failureCode === undefined ? {} : { failureCode },
    }
    const kind = classifyOutcome(this.resolved, outcome)
    if (kind === 'mutation') {
      this.revision += 1
      return
    }
    if (kind !== 'verification-failure' && kind !== 'verification-pass') return
    const current = this.retainedRecord(session)
    // Counters persist with the record. An in-memory-only counter restarts at
    // zero after resume, and the persisted order would then reject a legitimate
    // pass as stale.
    const sequence = (this.sequences.get(session) ?? current.sequence ?? 0) + 1
    this.sequences.set(session, sequence)
    this.revision = Math.max(this.revision, current.revision ?? 0)
    const next = applyEvidence(
      {
        base: current.base ?? this.resolved.baseLevel,
        ...current.exact === undefined ? {} : { exact: current.exact },
        ...current.openFailure === undefined ? {} : { openFailure: current.openFailure },
      },
      { kind, verifier: verifierIdentity(outcome), sequence, revision: this.revision },
    )
    const open = next.openFailure
    if (open?.verifier === current.openFailure?.verifier && open?.sequence === current.openFailure?.sequence) return
    const record: EffortStateRecord = {
      sequence,
      revision: this.revision,
      base: next.base,
      ...next.exact === undefined ? {} : { exact: next.exact },
      ...open === undefined ? {} : { openFailure: open },
    }
    session.append('effort/decision', decisionRecord(
      record,
      kind === 'verification-failure' ? 'escalated' : 'base',
    ))
  }

  /**
   * Decide the effort for one request.
   * @param capability - the exact route's advertised efforts.
   * @param session - the Session making the request; omission decides from the configured base.
   * @returns the decision and the rule that produced it.
   */
  decideFor(capability: EffortCapability, session?: Session): Decision {
    const state = session === undefined ? { base: this.resolved.baseLevel } : this.stateOf(session)
    return decide(capability, state)
  }

  /**
   * The starting level for a delegated operation.
   * @param operation - the delegation's declared operation.
   * @returns the operation's starting level.
   */
  levelFor(operation: DelegationOperation): EffortLevel {
    return operationStart(operation)
  }

  /**
   * The starting choice an Agent declares: its own effort when it has one, and
   * otherwise the level its delegated operation fixes. A top-level Agent
   * declares neither and starts at the configured base.
   * @param agent - the Agent whose options are read.
   * @returns its starting choice, or nothing when it declares none.
   */
  private startFor(agent: Agent): StartChoice | undefined {
    const declared = agent.options.reasoningEffort
    if (declared !== undefined) {
      return isEffortLevel(declared) ? { level: declared } : { exact: declared }
    }
    const operation = agent.options.effortOperation
    return operation === undefined ? undefined : { level: operationStart(operation) }
  }

  /**
   * The durable record for one Session, exactly as read. Absent fields are not
   * defaulted here: a configured base, a declared start, and a recorded pick are
   * different claims, and only the decision names which one applies.
   */
  private record(session: Session): EffortStateRecord {
    const projections = this.root.get('sessionProjections')
    if (projections === undefined) {
      throw new EffortPolicyUnavailableError(
        'effort-policy: the sessionProjections service is unavailable, so the durable effort record cannot be read',
      )
    }
    const stored = projections.stateOf(session, 'effort')
    if (stored === undefined) {
      throw new EffortPolicyUnavailableError(
        'effort-policy: the effort projection is not registered, so a missing record cannot be read as base state',
      )
    }
    const parsed = effortStateSchema.safeParse(stored)
    if (!parsed.success) {
      throw new EffortPolicyUnavailableError(
        `effort-policy: the stored effort record is unreadable, so the current level cannot be proven: ${parsed.error.message}`,
      )
    }
    const record = parsed.data
    this.lastKnown.set(session, record)
    return record
  }

  /**
   * Read the durable record, holding the last state this policy successfully
   * read when the current one cannot be read. Retaining a raised level is the
   * only fail-closed answer: an unreadable record is not evidence that the work
   * was repaired. A Session with nothing retained fails loud instead, because
   * guessing base would lower an unknown level.
   * @param session - the Session whose state is read.
   * @returns the record to decide from.
   */
  private retainedRecord(session: Session): EffortStateRecord {
    try {
      return this.record(session)
    } catch (error) {
      if (!(error instanceof EffortPolicyUnavailableError)) throw error
      const retained = this.lastKnown.get(session)
      if (retained === undefined) throw error
      return retained
    }
  }

  /**
   * Resolve a route's advertised effort vocabulary.
   *
   * An empty list means discovery succeeded and the route advertises no
   * reasoning. A missing runtime or a rejected lookup throws: those are
   * unavailable dependencies, not a route without reasoning, and treating them
   * as the latter would silently lower a persisted escalation.
   */
  private async capability(provider: string, model: string): Promise<EffortCapability> {
    const runtime = this.root.get('llm')
    if (runtime === undefined) {
      throw new EffortPolicyUnavailableError(
        'effort-policy: the llm runtime is unavailable, so route capability cannot be resolved',
      )
    }
    const info = await runtime.resolveModelInfo(provider, model)
    return {
      efforts: info.reasoning?.efforts.map(effort => String(effort.id)) ?? [],
      ...info.reasoning?.defaultEffort === undefined
        ? {}
        : { defaultEffort: String(info.reasoning.defaultEffort) },
    }
  }
}

export default EffortPolicy
